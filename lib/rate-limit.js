// In-memory rate limiter — per user, 1-hour fixed window.
// Fine for a single-instance deploy; multi-instance production → Redis (Upstash).
const WINDOW_MS = 60 * 60 * 1000
const LIMIT = Number(process.env.RATE_LIMIT ?? 20)

const buckets = new Map() // userId -> { count, resetAt }

export function checkRateLimit(userId) {
  const now = Date.now()
  let bucket = buckets.get(userId)

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(userId, bucket)
  }

  bucket.count += 1

  return {
    allowed: bucket.count <= LIMIT,
    remaining: Math.max(0, LIMIT - bucket.count),
    resetInMin: Math.ceil((bucket.resetAt - now) / 60000),
  }
}