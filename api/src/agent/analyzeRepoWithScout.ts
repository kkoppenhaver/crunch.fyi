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
        const messageId = message.message?.id;
        const usage = message.message?.usage;

        // Extract content
        const content = Array.isArray(message.message.content)
          ? message.message.content
              .filter((c) => c.type === 'text')
              .map(c => 'text' in c ? c.text : '')
              .join('')
          : String(message.message.content);

        // Check for tool use
        let toolName: string | undefined;
        if (Array.isArray(message.message.content)) {
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
              toolName = block.name;
              trace.logTurn({
                type: 'tool_use',
                content: JSON.stringify(block.input || {}),
                toolName: block.name,
                messageId,
                usage,
              });
            }
          }
        }

        // Log assistant turn
        trace.logTurn({
          type: 'assistant',
          content,
          messageId,
          usage,
        });

        // Generate progress message
        const progressMessage = extractProgressMessage(content, toolName);

        if (progressMessage !== lastProgressMessage) {
          lastProgressMessage = progressMessage;
          yield {
            type: 'progress',
            message: progressMessage,
          };
        }

        finalOutput = content;

      } else if (message.type === 'result') {
        const resultText = message.subtype === 'success'
          ? message.result
          : finalOutput;

        const article = parseArticle(resultText);

        // Log result
        trace.logResult(message.usage);
        trace.complete({ article, headline: article.headline }, true);
        await flushLangfuse();

        yield {
          type: 'complete',
          article,
        };
      }
    }
  } catch (error) {
    trace.error(error instanceof Error ? error.message : String(error));
    await flushLangfuse();
    throw error;
  }
}
