/**
 * GitHub Scout Tool for Claude Agent SDK
 *
 * Exposes the GitHub Scout functionality as an MCP tool that the agent
 * can call during its agentic loop to explore repositories without cloning.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  getRepoDigest,
  formatDigestForLLM,
  parseGitHubUrl,
  type RepoDigest
} from '../services/githubScout.js';

// Individual API functions for more granular access
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const headers: Record<string, string> = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'Crunch-FYI-Scout/1.0',
  ...(GITHUB_TOKEN && { 'Authorization': `Bearer ${GITHUB_TOKEN}` })
};

async function fetchGitHub(endpoint: string): Promise<any> {
  const url = `https://api.github.com${endpoint}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Create the GitHub Scout MCP server with tools for repo exploration
 */
export const githubScoutServer = createSdkMcpServer({
  name: 'github-scout',
  version: '1.0.0',
  tools: [
    // Main digest tool - gets comprehensive repo context in one call
    tool(
      'scout_repo',
      'Fetch comprehensive context about a GitHub repository without cloning. Returns metadata, README, file structure, and key code samples. Use this as your primary tool for understanding a repo.',
      {
        repo_url: z.string().describe('GitHub repository URL (e.g., github.com/owner/repo or https://github.com/owner/repo)')
      },
      async (args) => {
        try {
          const digest = await getRepoDigest(args.repo_url);
          const formattedContext = formatDigestForLLM(digest);

          return {
            content: [{
              type: 'text',
              text: formattedContext
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error fetching repository: ${error instanceof Error ? error.message : String(error)}`
            }]
          };
        }
      }
    ),

    // Get just metadata (quick check before deeper exploration)
    tool(
      'scout_metadata',
      'Get just the metadata for a GitHub repository (stars, description, language, topics). Useful for quick checks.',
      {
        repo_url: z.string().describe('GitHub repository URL')
      },
      async (args) => {
        try {
          const parsed = parseGitHubUrl(args.repo_url);
          if (!parsed) {
            return {
              content: [{
                type: 'text',
                text: `Invalid GitHub URL: ${args.repo_url}`
              }]
            };
          }

          const data = await fetchGitHub(`/repos/${parsed.owner}/${parsed.repo}`);

          const metadata = {
            name: data.name,
            description: data.description,
            language: data.language,
            stars: data.stargazers_count,
            forks: data.forks_count,
            topics: data.topics || [],
            license: data.license?.name || null,
            created: data.created_at,
            updated: data.updated_at,
            url: data.html_url
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(metadata, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }]
          };
        }
      }
    ),

    // Get file tree (for understanding structure)
    tool(
      'scout_tree',
      'Get the file tree of a GitHub repository. Returns all file paths and identifies key files.',
      {
        repo_url: z.string().describe('GitHub repository URL')
      },
      async (args) => {
        try {
          const parsed = parseGitHubUrl(args.repo_url);
          if (!parsed) {
            return {
              content: [{
                type: 'text',
                text: `Invalid GitHub URL: ${args.repo_url}`
              }]
            };
          }

          const data = await fetchGitHub(`/repos/${parsed.owner}/${parsed.repo}/git/trees/HEAD?recursive=1`);

          interface TreeItem {
            path: string;
            type: 'blob' | 'tree';
          }

          const files = data.tree
            .filter((item: TreeItem) => item.type === 'blob')
            .map((item: TreeItem) => item.path);

          const dirs = [...new Set(
            data.tree
              .filter((item: TreeItem) => item.type === 'tree')
              .map((item: TreeItem) => item.path)
          )] as string[];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                total_files: files.length,
                top_level_dirs: dirs.filter((d: string) => !d.includes('/')),
                files: files.slice(0, 100), // Limit to first 100
                truncated: files.length > 100
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }]
          };
        }
      }
    ),

    // Get specific file content
    tool(
      'scout_file',
      'Fetch the contents of a specific file from a GitHub repository. Use this to drill into files you are curious about.',
      {
        repo_url: z.string().describe('GitHub repository URL'),
        file_path: z.string().describe('Path to the file within the repository (e.g., src/index.ts)')
      },
      async (args) => {
        try {
          const parsed = parseGitHubUrl(args.repo_url);
          if (!parsed) {
            return {
              content: [{
                type: 'text',
                text: `Invalid GitHub URL: ${args.repo_url}`
              }]
            };
          }

          const data = await fetchGitHub(`/repos/${parsed.owner}/${parsed.repo}/contents/${args.file_path}`);

          if (data.type !== 'file') {
            return {
              content: [{
                type: 'text',
                text: `${args.file_path} is not a file`
              }]
            };
          }

          const content = Buffer.from(data.content, 'base64').toString('utf-8');

          // Truncate if too long
          const truncated = content.length > 5000;
          const displayContent = truncated ? content.slice(0, 5000) + '\n\n[... truncated ...]' : content;

          return {
            content: [{
              type: 'text',
              text: `## ${args.file_path}\n\n\`\`\`\n${displayContent}\n\`\`\``
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error fetching file: ${error instanceof Error ? error.message : String(error)}`
            }]
          };
        }
      }
    ),

    // Get README
    tool(
      'scout_readme',
      'Fetch the README file from a GitHub repository.',
      {
        repo_url: z.string().describe('GitHub repository URL')
      },
      async (args) => {
        try {
          const parsed = parseGitHubUrl(args.repo_url);
          if (!parsed) {
            return {
              content: [{
                type: 'text',
                text: `Invalid GitHub URL: ${args.repo_url}`
              }]
            };
          }

          const data = await fetchGitHub(`/repos/${parsed.owner}/${parsed.repo}/readme`);
          const content = Buffer.from(data.content, 'base64').toString('utf-8');

          // Truncate if too long
          const truncated = content.length > 8000;
          const displayContent = truncated ? content.slice(0, 8000) + '\n\n[... truncated ...]' : content;

          return {
            content: [{
              type: 'text',
              text: displayContent
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error fetching README: ${error instanceof Error ? error.message : String(error)}`
            }]
          };
        }
      }
    )
  ]
});

/**
 * Tool names for allowedTools configuration
 */
export const GITHUB_SCOUT_TOOLS = [
  'mcp__github-scout__scout_repo',
  'mcp__github-scout__scout_metadata',
  'mcp__github-scout__scout_tree',
  'mcp__github-scout__scout_file',
  'mcp__github-scout__scout_readme'
];
