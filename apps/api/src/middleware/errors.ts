import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { VerificationError } from '../modules/verification/service'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = 'REQUEST_FAILED',
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/**
 * Global error handling middleware.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof VerificationError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    })
    return
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.code,
      message: err.message,
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Request payload failed schema validation.',
      details: err.flatten(),
    })
    return
  }

  const message = err instanceof Error ? err.message : 'Internal Server Error'
  console.error('[API Error]:', err)

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message,
  })
}
