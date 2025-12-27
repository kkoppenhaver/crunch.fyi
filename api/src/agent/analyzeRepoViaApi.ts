/**
 * API-based Repository Analysis
 *
 * This version uses GitHub API to fetch repository context instead of cloning.
 * Benefits:
 * - No disk usage for large repos
 * - No exposure to prompt injection in cloned files
 * - Faster startup (no git clone wait)
 * - Lower bandwidth
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ArticleData, SSEEvent } from '../types/index.js';
import { createAgentTrace, flushLangfuse } from '../observability/langfuse.js';
import { getRepoDigest, formatDigestForLLM, parseGitHubUrl } from '../services/githubScout.js';

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

// Main function to analyze a repo via API and yield progress events
export async function* analyzeRepoViaApi(
  repoUrl: string,
  jobId: string
): AsyncGenerator<SSEEvent> {
  // Validate URL first
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }

  // Create Langfuse trace
  const trace = createAgentTrace({ jobId, repoUrl });

  try {
    yield {
      type: 'progress',
      message: 'Fetching repository metadata...',
    };

    // Fetch digest via GitHub API (no cloning!)
    const digest = await getRepoDigest(repoUrl);

    yield {
      type: 'progress',
      message: `Analyzed ${digest.structure.total_files} files in ${digest.repo.name}...`,
    };

    // Format context for the LLM
    const repoContext = formatDigestForLLM(digest);

    yield {
      type: 'progress',
      message: 'Generating satirical article...',
    };

    const prompt = `
You are a satirical tech journalist writing for a parody of TechCrunch. Your job is to write a hilariously exaggerated fake news article about a GitHub repository.

## Repository Context

${repoContext}

## Your Task

Based on the repository information above, write a satirical TechCrunch-style article that:
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

    // Use direct Anthropic API call (no agent SDK needed - we already have context)
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    // Extract text from response
    const outputText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Log to Langfuse
    trace.logTurn({
      type: 'assistant',
      content: outputText,
      messageId: response.id,
      usage: response.usage,
    });

    // Parse article
    const article = parseArticle(outputText);

    // Log completion
    trace.complete({ article, headline: article.headline }, true);
    await flushLangfuse();

    yield {
      type: 'complete',
      article,
    };

  } catch (error) {
    trace.error(error instanceof Error ? error.message : String(error));
    await flushLangfuse();
    throw error;
  }
}
