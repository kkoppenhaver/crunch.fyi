/**
 * Daily article rate limiter using Redis
 *
 * Caps the number of articles generated per day to control costs.
 * Uses a 24-hour rolling window with automatic expiry.
 */

import { connection } from '../queue/connection.js';

const DAILY_LIMIT = parseInt(process.env.DAILY_ARTICLE_LIMIT || '1000', 10);
const REDIS_KEY = 'crunch:daily_article_count';
const TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface RateLimitStatus {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}

/**
 * Check if we can generate another article (doesn't increment)
 */
export async function checkRateLimit(): Promise<RateLimitStatus> {
  const current = parseInt(await connection.get(REDIS_KEY) || '0', 10);
  const remaining = Math.max(0, DAILY_LIMIT - current);

  return {
    allowed: current < DAILY_LIMIT,
    current,
    limit: DAILY_LIMIT,
    remaining,
  };
}

/**
 * Increment the counter and check if we're within limits
 * Returns the new count and whether the request is allowed
 */
export async function incrementAndCheck(): Promise<RateLimitStatus> {
  // Increment atomically
  const newCount = await connection.incr(REDIS_KEY);

  // Set TTL on first increment (when count is 1)
  if (newCount === 1) {
    await connection.expire(REDIS_KEY, TTL_SECONDS);
  }

  const remaining = Math.max(0, DAILY_LIMIT - newCount);

  return {
    allowed: newCount <= DAILY_LIMIT,
    current: newCount,
    limit: DAILY_LIMIT,
    remaining,
  };
}

/**
 * Get time until the rate limit resets (in minutes)
 */
export async function getResetTime(): Promise<number | null> {
  const ttl = await connection.ttl(REDIS_KEY);
  if (ttl <= 0) return null;
  return Math.ceil(ttl / 60);
}
