/**
 * Daily article rate limiter using Redis
 *
 * Caps the number of articles generated per day to control costs.
 * Uses a 24-hour rolling window with automatic expiry.
 *
 * Two levels of rate limiting:
 * 1. Global: Total articles generated per day (default 1000)
 * 2. Per-IP: Articles per IP address per day (default 20)
 */

import { connection } from '../queue/connection.js';

const DAILY_LIMIT = parseInt(process.env.DAILY_ARTICLE_LIMIT || '1000', 10);
const IP_DAILY_LIMIT = parseInt(process.env.IP_DAILY_LIMIT || '20', 10);
const REDIS_KEY = 'crunch:daily_article_count';
const IP_REDIS_KEY_PREFIX = 'crunch:ip_daily:';
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

/**
 * Check per-IP rate limit (doesn't increment)
 */
export async function checkIpRateLimit(ip: string): Promise<RateLimitStatus> {
  const key = `${IP_REDIS_KEY_PREFIX}${ip}`;
  const current = parseInt(await connection.get(key) || '0', 10);
  const remaining = Math.max(0, IP_DAILY_LIMIT - current);

  return {
    allowed: current < IP_DAILY_LIMIT,
    current,
    limit: IP_DAILY_LIMIT,
    remaining,
  };
}

/**
 * Increment per-IP counter and check if within limits
 */
export async function incrementIpAndCheck(ip: string): Promise<RateLimitStatus> {
  const key = `${IP_REDIS_KEY_PREFIX}${ip}`;
  const newCount = await connection.incr(key);

  // Set TTL on first increment
  if (newCount === 1) {
    await connection.expire(key, TTL_SECONDS);
  }

  const remaining = Math.max(0, IP_DAILY_LIMIT - newCount);

  return {
    allowed: newCount <= IP_DAILY_LIMIT,
    current: newCount,
    limit: IP_DAILY_LIMIT,
    remaining,
  };
}

export interface CombinedRateLimitResult {
  allowed: boolean;
  reason?: 'global_limit' | 'ip_limit';
  global: RateLimitStatus;
  ip: RateLimitStatus;
}

/**
 * Check both global and per-IP limits, increment both if allowed
 */
export async function checkAndIncrementAll(ip: string): Promise<CombinedRateLimitResult> {
  // Check both limits first (without incrementing)
  const globalStatus = await checkRateLimit();
  const ipStatus = await checkIpRateLimit(ip);

  // If either limit is exceeded, don't increment
  if (!globalStatus.allowed) {
    return {
      allowed: false,
      reason: 'global_limit',
      global: globalStatus,
      ip: ipStatus,
    };
  }

  if (!ipStatus.allowed) {
    return {
      allowed: false,
      reason: 'ip_limit',
      global: globalStatus,
      ip: ipStatus,
    };
  }

  // Both limits OK - increment both counters
  const newGlobal = await incrementAndCheck();
  const newIp = await incrementIpAndCheck(ip);

  return {
    allowed: true,
    global: newGlobal,
    ip: newIp,
  };
}
