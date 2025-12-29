/**
 * Repository Analysis with GitHub Scout Subagent
 *
 * This version uses a subagent architecture:
 * - A "repo-scout" subagent (Haiku) explores the repository via GitHub API
 * - The main agent (Sonnet) writes the satirical article based on the findings
 *
 * Benefits:
 * - Haiku is faster and cheaper for the exploration phase
 * - Context isolation keeps exploration details separate from writing
 * - The main agent gets a clean summary to work with
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import type { ArticleData, SSEEvent } from '../types/index.js';
import { createAgentTrace, flushLangfuse } from '../observability/langfuse.js';
import { githubScoutServer, GITHUB_SCOUT_TOOLS } from '../tools/githubScoutTool.js';
import { getRandomHeroImage } from '../utils/heroImages.js';

// Debug logging helper
const DEBUG = process.env.NODE_ENV !== 'production';

function debug(category: string, message: string, data?: unknown) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  const prefix = `\x1b[36m[${timestamp}]\x1b[0m \x1b[33m[${category}]\x1b[0m`;
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

function debugTurn(turnNum: number, type: string, details: string) {
  if (!DEBUG) return;
  const colors: Record<string, string> = {
    assistant: '\x1b[32m',  // green
    tool_use: '\x1b[35m',   // magenta
    tool_result: '\x1b[34m', // blue
    result: '\x1b[33m',     // yellow
    subagent: '\x1b[36m',   // cyan
  };
  const color = colors[type] || '\x1b[0m';
  const reset = '\x1b[0m';
  console.log(`${color}┌─ Turn ${turnNum}: ${type}${reset}`);
  console.log(`${color}│${reset} ${details}`);
  console.log(`${color}└${'─'.repeat(50)}${reset}`);
}

// Clean LLM output by stripping markdown code blocks and preamble text
function cleanLLMOutput(output: string): string {
  let cleaned = output;

  // Extract content from markdown code blocks (```json ... ``` or ``` ... ```)
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  }

  // Remove common preamble patterns before the JSON
  // Look for the first { that starts a JSON object
  const jsonStartIndex = cleaned.indexOf('{');
  if (jsonStartIndex > 0) {
    cleaned = cleaned.slice(jsonStartIndex);
  }

  // Remove any trailing text after the JSON object
  // Find the last } that closes the JSON
  const jsonEndIndex = cleaned.lastIndexOf('}');
  if (jsonEndIndex !== -1 && jsonEndIndex < cleaned.length - 1) {
    cleaned = cleaned.slice(0, jsonEndIndex + 1);
  }

  return cleaned.trim();
}

// Parse the final article from Claude's output
function parseArticle(output: string): ArticleData {
  // Clean the output first - strip markdown and preamble
  const cleanedOutput = cleanLLMOutput(output);

  // Try to extract JSON from the cleaned output
  const jsonMatch = cleanedOutput.match(/\{[\s\S]*"headline"[\s\S]*\}/);

  // Select a random hero image for this article
  const heroImage = getRandomHeroImage();

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const authorName = parsed.author?.name || 'Chip Stacker';

      return {
        headline: parsed.headline || 'Untitled Article',
        author: {
          name: authorName,
          title: parsed.author?.title || 'Senior Disruption Correspondent',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authorName)}`,
          bio: parsed.author?.bio || 'A veteran tech journalist who has been making up quotes since before it was cool.',
          twitter: '', // No longer used
        },
        timestamp: new Date().toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        category: parsed.category || 'Startups',
        image: heroImage.url,
        imageCredit: heroImage.credit,
        tags: parsed.tags || ['Startups', 'Funding', 'Tech'],
        content: Array.isArray(parsed.content) ? parsed.content : [parsed.content || output],
      };
    } catch (e) {
      console.error('[Agent] Failed to parse JSON:', e);
    }
  }

  // Fallback
  return {
    headline: 'Breaking: This Repository is Definitely Worth $10M',
    author: {
      name: 'Chip Stacker',
      title: 'Senior Disruption Correspondent',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChipStacker',
      bio: 'A veteran tech journalist who has been making up quotes since before it was cool.',
      twitter: '',
    },
    timestamp: new Date().toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    category: 'Startups',
    image: heroImage.url,
    imageCredit: heroImage.credit,
    tags: ['Startups', 'Funding', 'Tech'],
    content: output.split('\n\n').filter(p => p.trim().length > 0),
  };
}

// Extract progress message from agent activity
function extractProgressMessage(content: string, toolName?: string, toolInput?: string): string {
  // Check for subagent invocation
  if (toolName === 'Task') {
    return 'Scout is exploring the repository...';
  }

  if (toolName) {
    if (toolName.includes('scout_repo')) {
      return 'Fetching repository overview...';
    }
    if (toolName.includes('scout_metadata')) {
      return 'Checking stars, forks, and activity...';
    }
    if (toolName.includes('scout_tree')) {
      return 'Mapping out the file structure...';
    }
    if (toolName.includes('scout_file')) {
      // Try to extract the file path from tool input
      if (toolInput) {
        try {
          const input = JSON.parse(toolInput);
          if (input.path) {
            const fileName = input.path.split('/').pop();
            return `Reading ${fileName}...`;
          }
        } catch {}
      }
      return 'Reading source files...';
    }
    if (toolName.includes('scout_readme')) {
      return 'Reading the README...';
    }
  }

  // Only detect article writing when we see actual JSON output structure
  // (not just the word "article" in planning text)
  if (content.includes('"headline"') || content.includes('```json')) {
    return 'Writing satirical article...';
  }

  return 'Analyzing repository...';
}

/**
 * Create the repo-scout subagent definition
 * Uses Haiku for fast, cheap repository exploration
 */
function createRepoScoutAgent(): AgentDefinition {
  return {
    description: 'Repository exploration specialist. Use this agent to gather high-level information about a GitHub repository.',
    prompt: `You are a repository research specialist. Your job is to quickly explore a GitHub repository and compile a high-level summary.

When given a repository URL, gather just enough to understand:

1. **What it does** (use scout_readme)
   - The main purpose/problem it solves
   - Any bold claims or interesting features mentioned
   - Who made it

2. **Basic context** (use scout_repo or scout_metadata)
   - Name, description, primary language
   - General popularity/activity level

**Important: Keep it high-level.** Don't dive deep into:
- Specific technical implementation details
- Individual source files or code patterns
- Detailed file structure analysis
- Specific dependencies or frameworks used

The goal is to understand the project's PURPOSE and any amusing/interesting claims it makes - not its technical architecture. A satirical article doesn't need to know what CSS framework they use or how their database is structured.

Be efficient - 2-3 tool calls maximum. Get the README and basic metadata, that's usually enough.`,
    tools: GITHUB_SCOUT_TOOLS,
    model: 'haiku',
  };
}

// Main function to analyze a repo using the Scout subagent
export async function* analyzeRepoWithScout(
  repoUrl: string,
  jobId: string
): AsyncGenerator<SSEEvent> {
  // Create Langfuse trace
  const trace = createAgentTrace({ jobId, repoUrl });

  debug('Agent', `Starting analysis for job ${jobId}`);
  debug('Agent', `Repository: ${repoUrl}`);
  debug('Agent', 'Using subagent architecture: Haiku (scout) -> Sonnet (writer)');

  let turnCount = 0;

  try {
    yield {
      type: 'progress',
      message: 'Starting repository analysis...',
    };

    const prompt = `
You are a satirical tech journalist writing for a parody of TechCrunch. Your job is to write a hilariously exaggerated fake news article about a GitHub repository.

## Your Task

1. First, use the repo-scout agent to explore this repository: ${repoUrl}
   The scout will gather high-level information about what the project does.

2. Based on what the scout finds, write a satirical TechCrunch-style article.

## What Works Well (Do These)

**Headlines & Structure:**
- Clickbait headlines about fake funding rounds (Series A, B, C, etc.)
- Open with "SAN FRANCISCO —" and an absurd comparison ("the most important advancement since Comic Sans")
- End with a punchy conclusion that ties the absurdity together

**Quotes & Characters:**
- Made-up quotes from "anonymous VCs" with ridiculous names (Preston Moneybags IV, Chad Disruptington III)
- Fake VC firms with absurd names (Disruption Capital Partners, Sequoia Clone Capital)
- Nested fund jokes like "Andreessen Horowitz's AI Fund's AI Fund's AI Fund (a16z³)"
- Self-aware jargon mocking where VCs stack buzzwords and make simple math sound impressive
- Absurd author personas with ridiculous titles ("Chief Hype Correspondent & Blockchain Whisperer")

**Satirical Techniques:**
- Elevate mundane things to absurd importance ("TitleCase naming elevated to constitutional principle status")
- Frame obvious real-world alternatives as "legacy solutions" ("legacy ice discovery solutions like 'asking the person at the gas station'")
- Escalate concepts to absurd political/philosophical territory ("Marxist-Leninist-Markdownist theory")
- Dismiss reasonable criticism with VC logic ("validated by Sand Hill Road")
- Invent absurd regulatory bodies ("U.S. Department of Memes")
- Exaggerated product roadmaps with ridiculous naming ("Ultra-Mega-Turbo-Plus")
- Take real features and exaggerate to absurdity ("my AI is 5% too curious")

## What to Avoid (Don't Do These)

- **No GitHub star counts or "dollars per star" valuation jokes** - too niche
- **No specific technical details** - avoid mentioning specific frameworks, CSS values, database names, file formats. Keep tech references high-level and breezy. TechCrunch wouldn't mention "5px borders" or "Alpine.js"
- **No rhetorical questions** - avoid "The company's revolutionary achievement?"
- **No disclaimers** - stay in character, the site handles context
- **Don't overuse the "everyone pivoting to copy" trope** - use sparingly

## Important Guidelines

- The satire should be obvious - no one should think this is real news
- Focus on the absurdity of tech hype, not on insulting the actual project
- If mentioning the real project creator by name, make sure it's accurate
- Keep it funny but not mean-spirited
- Write like a real TechCrunch article in tone and structure, just with absurd content

## Output Format

Return your article as JSON with this exact structure:
{
  "headline": "Your clickbait headline here",
  "category": "Startups",
  "tags": ["tag1", "tag2", "tag3"],
  "author": {
    "name": "A quirky, funny fake journalist name",
    "title": "Their ridiculous job title",
    "bio": "A 1-2 sentence bio that's amusing and fits the satirical tone"
  },
  "content": [
    "First paragraph...",
    "Second paragraph with fake VC quote...",
    "Third paragraph...",
    "More paragraphs as needed..."
  ]
}

Make sure the JSON is valid and parseable.
`;

    // Log the prompt to Langfuse
    trace.logPrompt(prompt);

    let lastProgressMessage = '';
    let finalOutput = '';
    let wasInSubagent = false;

    debug('Agent', 'Starting Claude Agent SDK query with repo-scout subagent...');

    // Run the main agent with the repo-scout subagent
    for await (const message of query({
      prompt,
      options: {
        mcpServers: {
          'github-scout': githubScoutServer
        },
        // Task tool required for subagent invocation
        allowedTools: ['Task'],
        agents: {
          'repo-scout': createRepoScoutAgent(),
        },
        // Bypass permissions so MCP tools can execute without prompts
        // (subagents can't answer permission prompts)
        permissionMode: 'bypassPermissions',
        maxTurns: 20,
      }
    })) {
      // Check if this message is from the subagent
      const isSubagentMessage = 'parent_tool_use_id' in message && (message as any).parent_tool_use_id;

      // Detect when we exit the subagent (scout finished, now writing)
      if (wasInSubagent && !isSubagentMessage && message.type === 'assistant') {
        const progressMessage = 'Writing satirical article...';
        if (progressMessage !== lastProgressMessage) {
          lastProgressMessage = progressMessage;
          debug('Progress', progressMessage);
          yield {
            type: 'progress',
            message: progressMessage,
          };
        }
      }

      // Track subagent state
      if (isSubagentMessage) {
        wasInSubagent = true;
      }

      if (message.type === 'assistant') {
        turnCount++;
        const messageId = message.message?.id;
        const usage = message.message?.usage;

        // Extract content
        const content = Array.isArray(message.message.content)
          ? message.message.content
              .filter((c: { type: string }) => c.type === 'text')
              .map((c: { type: string; text?: string }) => c.text ?? '')
              .join('')
          : String(message.message.content);

        // Check for tool use and log each one
        const toolCalls: Array<{ name: string; input: string }> = [];
        if (Array.isArray(message.message.content)) {
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
              const toolInput = JSON.stringify(block.input || {});
              const toolName = block.name;
              toolCalls.push({ name: toolName, input: toolInput });

              // Special logging for subagent invocation
              if (toolName === 'Task') {
                const input = block.input as { subagent_type?: string; prompt?: string } | undefined;
                debugTurn(turnCount, 'subagent', `Invoking ${input?.subagent_type || 'unknown'} subagent`);
              } else {
                const prefix = isSubagentMessage ? '[Scout] ' : '';
                debugTurn(turnCount, 'tool_use', `${prefix}${toolName} with input: ${toolInput.slice(0, 200)}${toolInput.length > 200 ? '...' : ''}`);
              }

              trace.logTurn({
                type: 'tool_use',
                content: toolInput,
                toolName,
                messageId,
                usage,
              });
            }
          }
        }

        // Log assistant content if any
        if (content.trim()) {
          const prefix = isSubagentMessage ? '[Scout] ' : '';
          const preview = content.slice(0, 300).replace(/\n/g, ' ');
          debugTurn(turnCount, 'assistant', `${prefix}${preview}${content.length > 300 ? '...' : ''}`);
        }

        // Log usage stats
        if (usage) {
          const prefix = isSubagentMessage ? 'Scout ' : '';
          debug('Usage', `${prefix}Turn ${turnCount}: in=${usage.input_tokens || 0} out=${usage.output_tokens || 0} cache_read=${usage.cache_read_input_tokens || 0}`);
        }

        // Log assistant turn
        trace.logTurn({
          type: 'assistant',
          content,
          messageId,
          usage,
        });

        // Generate progress message
        const firstTool = toolCalls[0];
        const progressMessage = extractProgressMessage(content, firstTool?.name, firstTool?.input);

        if (progressMessage !== lastProgressMessage) {
          lastProgressMessage = progressMessage;
          debug('Progress', progressMessage);
          yield {
            type: 'progress',
            message: progressMessage,
          };
        }

        finalOutput = content;

      } else if (message.type === 'result') {
        debug('Agent', `Completed with subtype: ${message.subtype}`);

        const resultText = message.subtype === 'success'
          ? message.result
          : finalOutput;

        // Log final usage
        if (message.usage) {
          const usage = message.usage as Record<string, unknown>;
          debug('Usage', 'Final stats:', {
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            total_cost_usd: usage.total_cost_usd,
          });
        }

        const article = parseArticle(resultText);
        debug('Article', `Headline: "${article.headline}"`);
        debug('Article', `Paragraphs: ${article.content.length}`);

        // Log result
        trace.logResult(message.usage);
        trace.complete({ article, headline: article.headline }, true);
        await flushLangfuse();

        debugTurn(turnCount + 1, 'result', `Article generated: "${article.headline}"`);

        yield {
          type: 'complete',
          article,
        };
      }
    }

    debug('Agent', `Analysis complete. Total turns: ${turnCount}`);
  } catch (error) {
    trace.error(error instanceof Error ? error.message : String(error));
    await flushLangfuse();
    throw error;
  }
}
