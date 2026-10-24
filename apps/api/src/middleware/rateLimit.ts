import type { NextFunction, Request, Response } from 'express'

interface RateLimitEntry {
  count: number
  resetTime: number
}

export interface RateLimitOptions {
  windowMs?: number
  maxRequests?: number
  keyGenerator?: (req: Request) => string | undefined
  message?: string
}

/**
 * In-memory sliding-window rate limiter per IP, account, and domain.
 * (Amendment f: rate limiting per account, IP and domain)
 */
export class MemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>()

  constructor(
    private defaultWindowMs: number = 60 * 1000,
    private defaultMax: number = 60,
  ) {}

  check(
    key: string,
    windowMs: number = this.defaultWindowMs,
    maxRequests: number = this.defaultMax,
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number; resetTime: number } {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowMs
      this.store.set(key, { count: 1, resetTime })
      return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0, resetTime }
    }

    if (entry.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000)
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
        resetTime: entry.resetTime,
      }
    }

    entry.count += 1
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      retryAfterSeconds: 0,
      resetTime: entry.resetTime,
    }
  }

  clear(): void {
    this.store.clear()
  }
}

export const globalLimiter = new MemoryRateLimiter()

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60 * 1000
  const maxRequests = options.maxRequests ?? 60

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip || req.socket.remoteAddress || 'unknown-ip')

    if (!key) {
      next()
      return
    }

    const { allowed, remaining, retryAfterSeconds, resetTime } = globalLimiter.check(
      key,
      windowMs,
      maxRequests,
    )

    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000))

    if (!allowed) {
      res.setHeader('Retry-After', retryAfterSeconds)
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Rate limit exceeded. Please try again later.',
        retryAfter: retryAfterSeconds,
      })
      return
    }

    next()
  }
}

/**
 * Rate limit per authenticated user account.
 */
export function rateLimitByUser(maxRequests: number = 100, windowMs: number = 60 * 1000) {
  return rateLimit({
    maxRequests,
    windowMs,
    keyGenerator: req => (req.user ? `user:${req.user.id}` : undefined),
    message: 'Account rate limit exceeded. Please slow down.',
  })
}

/**
 * Rate limit per target domain.
 */
export function rateLimitByDomain(
  maxRequests: number = 10,
  windowMs: number = 60 * 1000,
  getDomainKey: (req: Request) => string | undefined = req => {
    const param = req.params?.id
    if (typeof param === 'string') return param
    const bodyDomain = (req.body as { domainId?: unknown })?.domainId
    return typeof bodyDomain === 'string' ? bodyDomain : undefined
  },
) {
  return rateLimit({
    maxRequests,
    windowMs,
    keyGenerator: req => {
      const domain = getDomainKey(req)
      return domain ? `domain:${domain}` : undefined
    },
    message: 'Domain rate limit exceeded for this operation. Please wait before retrying.',
  })
}
