import Langfuse from 'langfuse';

// Initialize Langfuse client
const isDev = process.env.NODE_ENV !== 'production';
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  release: isDev ? 'development' : 'production',
});

// Verify connection on startup
if (process.env.LANGFUSE_PUBLIC_KEY) {
  console.log('[Langfuse] Observability enabled');
} else {
  console.log('[Langfuse] Disabled - no LANGFUSE_PUBLIC_KEY set');
}

// Default model used by Claude Agent SDK
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export interface AgentTraceOptions {
  jobId: string;
  repoUrl: string;
  userId?: string;
  model?: string;
}

export interface AgentTurn {
  turnNumber: number;
  type: 'assistant' | 'tool_use' | 'tool_result' | 'result';
  content: string;
  toolName?: string;
  messageId?: string;
  usage?: SDKUsage;
  metadata?: Record<string, unknown>;
}

export interface SDKUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCostUsd?: number;
}

/**
 * Creates a trace for an agent run
 */
export function createAgentTrace(options: AgentTraceOptions) {
  const model = options.model || DEFAULT_MODEL;

  const trace = langfuse.trace({
    id: options.jobId,
    name: 'article-generation',
    metadata: {
      repoUrl: options.repoUrl,
      model,
    },
    userId: options.userId,
    tags: ['claude-agent-sdk', 'article-generation'],
  });

  let turnCount = 0;
  let currentGeneration: ReturnType<typeof trace.generation> | null = null;

  // Track usage by message ID to avoid double-counting
  // (multiple messages in same step share the same ID and usage)
  const processedMessageIds = new Set<string>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreationTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCostUsd: number | undefined;

  return {
    trace,

    /**
     * Log the initial prompt sent to the agent
     */
    logPrompt(prompt: string) {
      trace.update({
        input: { prompt },
      });

      // Start a generation span for the entire agent run
      currentGeneration = trace.generation({
        name: 'claude-agent-run',
        model,
        input: prompt.slice(0, 10000),
        metadata: {
          type: 'agent-run',
        },
      });
    },

    /**
     * Log an agent turn (assistant message, tool use, etc.)
     * Uses actual SDK usage data when available
     */
    logTurn(turn: Omit<AgentTurn, 'turnNumber'>) {
      turnCount++;

      // Track usage from SDK (deduplicate by message ID)
      if (turn.messageId && turn.usage && !processedMessageIds.has(turn.messageId)) {
        processedMessageIds.add(turn.messageId);
        totalInputTokens += turn.usage.input_tokens || 0;
        totalOutputTokens += turn.usage.output_tokens || 0;
        totalCacheCreationTokens += turn.usage.cache_creation_input_tokens || 0;
        totalCacheReadTokens += turn.usage.cache_read_input_tokens || 0;
      }

      const span = trace.span({
        name: `turn-${turnCount}-${turn.type}`,
        input: turn.type === 'tool_use' ? { tool: turn.toolName, args: turn.content.slice(0, 500) } : undefined,
        output: { content: turn.content.slice(0, 1000) },
        metadata: {
          turnNumber: turnCount,
          type: turn.type,
          toolName: turn.toolName,
          messageId: turn.messageId,
          usage: turn.usage,
          ...turn.metadata,
        },
      });

      span.end();
      return turnCount;
    },

    /**
     * Log final result with cumulative usage from SDK
     */
    logResult(resultUsage?: { total_cost_usd?: number } & SDKUsage) {
      if (resultUsage) {
        totalCostUsd = resultUsage.total_cost_usd;
        // Result message contains authoritative cumulative usage
        if (resultUsage.input_tokens !== undefined) {
          totalInputTokens = resultUsage.input_tokens;
        }
        if (resultUsage.output_tokens !== undefined) {
          totalOutputTokens = resultUsage.output_tokens;
        }
        if (resultUsage.cache_creation_input_tokens != null) {
          totalCacheCreationTokens = resultUsage.cache_creation_input_tokens;
        }
        if (resultUsage.cache_read_input_tokens != null) {
          totalCacheReadTokens = resultUsage.cache_read_input_tokens;
        }
      }
    },

    /**
     * Mark the trace as complete with final output and usage stats
     */
    complete(output: Record<string, unknown>, success = true) {
      const totalTokens = totalInputTokens + totalOutputTokens;

      // End the generation span with final usage
      if (currentGeneration) {
        currentGeneration.update({
          output: output,
          usage: {
            input: totalInputTokens,
            output: totalOutputTokens,
            total: totalTokens,
          },
          costDetails: totalCostUsd ? {
            total: totalCostUsd,
          } : undefined,
        });
        currentGeneration.end();
      }

      trace.update({
        output,
        metadata: {
          totalTurns: turnCount,
          success,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cacheCreationTokens: totalCacheCreationTokens,
            cacheReadTokens: totalCacheReadTokens,
            totalTokens,
            totalCostUsd,
          },
        },
      });
    },

    /**
     * Mark the trace as failed with error
     */
    error(error: string) {
      const totalTokens = totalInputTokens + totalOutputTokens;

      if (currentGeneration) {
        currentGeneration.update({
          output: { error },
          usage: {
            input: totalInputTokens,
            output: totalOutputTokens,
            total: totalTokens,
          },
          statusMessage: error,
        });
        currentGeneration.end();
      }

      trace.update({
        output: { error },
        metadata: {
          totalTurns: turnCount,
          success: false,
          error,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cacheCreationTokens: totalCacheCreationTokens,
            cacheReadTokens: totalCacheReadTokens,
            totalTokens,
            totalCostUsd,
          },
        },
        tags: ['error'],
      });
    },

    /**
     * Get current usage statistics
     */
    getUsage(): UsageStats {
      return {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheCreationTokens: totalCacheCreationTokens,
        cacheReadTokens: totalCacheReadTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        totalCostUsd,
      };
    },
  };
}

/**
 * Flush all pending events to Langfuse
 * Call this before process exit or after important operations
 */
export async function flushLangfuse() {
  await langfuse.flushAsync();
}

/**
 * Shutdown Langfuse client
 */
export async function shutdownLangfuse() {
  await langfuse.shutdownAsync();
}

export { langfuse };
