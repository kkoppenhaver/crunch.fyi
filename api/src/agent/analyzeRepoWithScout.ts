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

// Parse the final article from Claude's output
function parseArticle(output: string): ArticleData {
  // Try to extract JSON from the output
  const jsonMatch = output.match(/\{[\s\S]*"headline"[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        headline: parsed.headline || 'Untitled Article',
        author: {
          name: parsed.author?.name || 'Connie Loizos',
          title: parsed.author?.title || 'Silicon Valley Editor',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Connie',
          bio: 'Connie Loizos is a Silicon Valley-based writer who has covered the startup industry for more than two decades.',
          twitter: 'conniel',
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
        image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2560&auto=format&fit=crop',
        imageCredit: 'GitHub / AI Generated',
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
      name: 'Connie Loizos',
      title: 'Silicon Valley Editor',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Connie',
      bio: 'Connie Loizos is a Silicon Valley-based writer who has covered the startup industry for more than two decades.',
      twitter: 'conniel',
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
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2560&auto=format&fit=crop',
    imageCredit: 'GitHub / AI Generated',
    tags: ['Startups', 'Funding', 'Tech'],
    content: output.split('\n\n').filter(p => p.trim().length > 0),
  };
}

// Extract progress message from agent activity
function extractProgressMessage(content: string, toolName?: string): string {
  // Check for subagent invocation
  if (toolName === 'Task') {
    return 'Exploring repository with scout...';
  }

  if (toolName) {
    if (toolName.includes('scout_repo')) return 'Fetching repository context...';
    if (toolName.includes('scout_metadata')) return 'Checking repository metadata...';
    if (toolName.includes('scout_tree')) return 'Exploring file structure...';
    if (toolName.includes('scout_file')) return 'Reading source files...';
    if (toolName.includes('scout_readme')) return 'Reading documentation...';
  }

  if (content.includes('headline') || content.includes('article')) {
    return 'Writing satirical article...';
  }
  if (content.includes('JSON') || content.includes('output')) {
    return 'Formatting article...';
  }

  return 'Analyzing repository...';
}

/**
 * Create the repo-scout subagent definition
 * Uses Haiku for fast, cheap repository exploration
 */
function createRepoScoutAgent(): AgentDefinition {
  return {
    description: 'Repository exploration specialist. Use this agent to gather comprehensive information about a GitHub repository including metadata, file structure, README, and key source files.',
    prompt: `You are a repository research specialist. Your job is to thoroughly explore a GitHub repository and compile a comprehensive research report.

When given a repository URL, use the available Scout tools to gather:

1. **Repository Overview** (use scout_repo or scout_metadata)
   - Name, description, primary language
   - Star count, fork count, topics
   - License and recent activity

2. **Structure Analysis** (use scout_tree if needed)
   - Top-level directory structure
   - Key files (package.json, requirements.txt, go.mod, etc.)
   - Source code organization

3. **Documentation** (use scout_readme)
   - What the project does
   - How to use it
   - Any notable features or claims

4. **Code Insights** (use scout_file for interesting files)
   - Main entry points
   - Interesting patterns or technologies used
   - Any amusing or notable code comments

Compile your findings into a clear, structured report that another agent can use to write about this repository. Focus on facts and interesting details that would make for good satire about startup culture.

Be thorough but efficient - gather what's needed without excessive API calls.`,
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

1. First, use the repo-scout agent to thoroughly explore this repository: ${repoUrl}
   The scout will gather metadata, documentation, and code insights for you.

2. Based on what the scout finds, write a satirical TechCrunch-style article that:
   - Has a clickbait headline about fake funding (Series A, B, etc.)
   - Includes made-up quotes from "anonymous VCs" and "industry insiders"
   - Wildly exaggerates the project's importance
   - Pokes fun at startup culture, tech buzzwords, and hype cycles
   - Is funny but not mean-spirited

## Important Guidelines

- The satire should be obvious - no one should think this is real news
- Focus on the absurdity of tech hype, not on insulting the actual project
- Reference specific details from the repo (stars, language, features) for authenticity
- Make up ridiculous valuations based on the star count

## Output Format

Return your article as JSON with this exact structure:
{
  "headline": "Your clickbait headline here",
  "category": "Startups",
  "tags": ["tag1", "tag2", "tag3"],
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
        const toolCalls: string[] = [];
        if (Array.isArray(message.message.content)) {
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
              const toolInput = JSON.stringify(block.input || {});
              const toolName = block.name;
              toolCalls.push(`${toolName}(${toolInput.slice(0, 100)}${toolInput.length > 100 ? '...' : ''})`);

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
        const progressMessage = extractProgressMessage(content, toolCalls[0]?.split('(')[0]);

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
