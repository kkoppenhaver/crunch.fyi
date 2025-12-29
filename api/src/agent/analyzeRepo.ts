import { query } from '@anthropic-ai/claude-agent-sdk';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';
import type { ArticleData, SSEEvent } from '../types/index.js';
import { createAgentTrace, flushLangfuse } from '../observability/langfuse.js';
import { getRandomHeroImage } from '../utils/heroImages.js';

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/crunch-repos';

// Generate a working directory for a job
function getWorkDir(jobId: string): string {
  return join(TEMP_DIR, jobId);
}

// Clean up cloned repo after job completes
async function cleanup(jobId: string): Promise<void> {
  const workDir = getWorkDir(jobId);
  try {
    await rm(workDir, { recursive: true, force: true });
    console.log(`[Agent] Cleaned up ${workDir}`);
  } catch (error) {
    console.error(`[Agent] Failed to cleanup ${workDir}:`, error);
  }
}

// Extract a user-friendly progress message from Claude's output
function extractProgressMessage(content: string): string {
  // Look for common patterns in agent output
  if (content.includes('git clone') || content.includes('Cloning')) {
    return 'Cloning repository...';
  }
  if (content.includes('package.json') || content.includes('dependencies')) {
    return 'Analyzing dependencies...';
  }
  if (content.includes('README') || content.includes('readme')) {
    return 'Reading documentation...';
  }
  if (content.includes('src/') || content.includes('source')) {
    return 'Examining source code...';
  }
  if (content.includes('test') || content.includes('spec')) {
    return 'Reviewing test coverage...';
  }
  if (content.includes('generating') || content.includes('writing')) {
    return 'Generating article...';
  }
  if (content.includes('headline') || content.includes('title')) {
    return 'Crafting headline...';
  }
  // Default progress message
  return 'Analyzing codebase...';
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

      // Build full article with defaults
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
        image: heroImage.url,
        imageCredit: heroImage.credit,
        tags: parsed.tags || ['Startups', 'Funding', 'Tech'],
        content: Array.isArray(parsed.content) ? parsed.content : [parsed.content || output],
      };
    } catch (e) {
      console.error('[Agent] Failed to parse JSON:', e);
    }
  }

  // Fallback: treat the entire output as article content
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
    image: heroImage.url,
    imageCredit: heroImage.credit,
    tags: ['Startups', 'Funding', 'Tech'],
    content: output.split('\n\n').filter(p => p.trim().length > 0),
  };
}

// Main function to analyze a repo and yield progress events
export async function* analyzeRepo(
  repoUrl: string,
  jobId: string
): AsyncGenerator<SSEEvent> {
  const workDir = getWorkDir(jobId);

  // Create Langfuse trace for this agent run
  const trace = createAgentTrace({ jobId, repoUrl });

  try {
    // Create working directory
    await mkdir(workDir, { recursive: true });

    yield {
      type: 'progress',
      message: 'Initializing analysis...',
    };

    const prompt = `
You are a satirical tech journalist writing for a parody of TechCrunch. Your job is to analyze a GitHub repository and write a hilariously exaggerated fake news article about it.

## Your Task

1. Clone this repository: ${repoUrl}
2. Read the README, package.json (if exists), and examine key source files
3. Understand what the project actually does
4. Write a satirical TechCrunch-style article that:
   - Has a clickbait headline about fake funding (Series A, B, etc.)
   - Includes made-up quotes from "anonymous VCs" and "industry insiders"
   - Wildly exaggerates the project's importance
   - Pokes fun at startup culture, tech buzzwords, and hype cycles
   - Is funny but not mean-spirited

## Important Guidelines

- Work in this directory: ${workDir}
- Be creative and humorous
- The satire should be obvious - no one should think this is real news
- Focus on the absurdity of tech hype, not on insulting the actual project

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

    // Run the Claude Agent
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ['Bash', 'Read', 'Grep', 'Glob', 'Write'],
        permissionMode: 'acceptEdits',
        maxTurns: 30,
        cwd: workDir,
      },
    })) {
      if (message.type === 'assistant') {
        // Extract message ID and usage from SDK
        const messageId = message.message?.id;
        const usage = message.message?.usage;

        // Extract content from assistant message
        const content = Array.isArray(message.message.content)
          ? message.message.content
              .filter((c: { type: string }) => c.type === 'text')
              .map((c: { type: string; text?: string }) => c.text ?? '')
              .join('')
          : String(message.message.content);

        // Log assistant turn to Langfuse with SDK usage data
        trace.logTurn({
          type: 'assistant',
          content,
          messageId,
          usage,
        });

        // Check for tool use in the message content
        if (Array.isArray(message.message.content)) {
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
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

        // Generate progress message
        const progressMessage = extractProgressMessage(content);

        // Only yield if message changed (avoid spam)
        if (progressMessage !== lastProgressMessage) {
          lastProgressMessage = progressMessage;
          yield {
            type: 'progress',
            message: progressMessage,
          };
        }

        // Accumulate output for final parsing
        finalOutput = content;
      } else if (message.type === 'result') {
        // Job completed - parse the article
        // For success, result is a string. For errors, use finalOutput
        const resultText = message.subtype === 'success'
          ? message.result
          : finalOutput;
        const article = parseArticle(resultText);

        // Log result usage (contains authoritative cumulative usage and total_cost_usd)
        trace.logResult(message.usage);

        // Log completion to Langfuse
        trace.complete({ article, headline: article.headline }, true);
        await flushLangfuse();

        yield {
          type: 'complete',
          article,
        };
      }
    }
  } catch (error) {
    // Log error to Langfuse
    trace.error(error instanceof Error ? error.message : String(error));
    await flushLangfuse();
    throw error;
  } finally {
    // Always cleanup after job completes
    await cleanup(jobId);
  }
}
