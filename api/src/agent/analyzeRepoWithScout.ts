/**
 * Repository Analysis with GitHub Scout Tool
 *
 * This version gives the Claude Agent SDK access to GitHub Scout tools,
 * allowing it to explore repositories via API calls without cloning.
 *
 * The agent can:
 * - Use scout_repo for comprehensive context
 * - Use scout_file to drill into specific files
 * - Use scout_tree to see the structure
 * - Use scout_readme to read documentation
 *
 * This is more flexible than the hardcoded approach because the agent
 * can decide what to explore based on what it learns.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
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
  const colors: Record<string, string> = {
    assistant: '\x1b[32m',  // green
    tool_use: '\x1b[35m',   // magenta
    tool_result: '\x1b[34m', // blue
    result: '\x1b[33m',     // yellow
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

// Main function to analyze a repo using the Scout tools
export async function* analyzeRepoWithScout(
  repoUrl: string,
  jobId: string
): AsyncGenerator<SSEEvent> {
  // Create Langfuse trace
  const trace = createAgentTrace({ jobId, repoUrl });

  debug('Agent', `Starting analysis for job ${jobId}`);
  debug('Agent', `Repository: ${repoUrl}`);
  debug('Agent', `Available tools: ${GITHUB_SCOUT_TOOLS.join(', ')}`);

  let turnCount = 0;

  try {
    yield {
      type: 'progress',
      message: 'Starting repository analysis...',
    };

    const prompt = `
You are a satirical tech journalist writing for a parody of TechCrunch. Your job is to analyze a GitHub repository and write a hilariously exaggerated fake news article about it.

## Your Task

1. Use the scout_repo tool to get comprehensive context about this repository: ${repoUrl}
2. If you need more details about specific files, use scout_file to explore them
3. Based on what you learn, write a satirical TechCrunch-style article that:
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

    debug('Agent', 'Starting Claude Agent SDK query...');

    // Run the Claude Agent with Scout tools
    for await (const message of query({
      prompt,
      options: {
        mcpServers: {
          'github-scout': githubScoutServer
        },
        allowedTools: GITHUB_SCOUT_TOOLS,
        maxTurns: 15,
      }
    })) {
      if (message.type === 'assistant') {
        turnCount++;
        const messageId = message.message?.id;
        const usage = message.message?.usage;

        // Extract content
        const content = Array.isArray(message.message.content)
          ? message.message.content
              .filter((c) => c.type === 'text')
              .map(c => 'text' in c ? c.text : '')
              .join('')
          : String(message.message.content);

        // Check for tool use and log each one
        const toolCalls: string[] = [];
        if (Array.isArray(message.message.content)) {
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
              const toolInput = JSON.stringify(block.input || {});
              toolCalls.push(`${block.name}(${toolInput.slice(0, 100)}${toolInput.length > 100 ? '...' : ''})`);

              debugTurn(turnCount, 'tool_use', `${block.name} with input: ${toolInput.slice(0, 200)}${toolInput.length > 200 ? '...' : ''}`);

              trace.logTurn({
                type: 'tool_use',
                content: toolInput,
                toolName: block.name,
                messageId,
                usage,
              });
            }
          }
        }

        // Log assistant content if any
        if (content.trim()) {
          const preview = content.slice(0, 300).replace(/\n/g, ' ');
          debugTurn(turnCount, 'assistant', `${preview}${content.length > 300 ? '...' : ''}`);
        }

        // Log usage stats
        if (usage) {
          debug('Usage', `Turn ${turnCount}: in=${usage.input_tokens || 0} out=${usage.output_tokens || 0} cache_read=${usage.cache_read_input_tokens || 0}`);
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
