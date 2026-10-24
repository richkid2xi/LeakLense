import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import type { PrismaClient } from '@prisma/client'
import { healthRouter } from './routes/health'
import { createDomainsRouter } from './routes/domains'
import { createScansRouter, type ScanEnqueuer } from './routes/scans'
import { createFindingsRouter } from './routes/findings'
import { requireAuth } from './middleware/auth'
import { rateLimit } from './middleware/rateLimit'
import { errorHandler } from './middleware/errors'

export interface AppOptions {
  prisma?: PrismaClient
  scanEnqueuer?: ScanEnqueuer
}

export function createApp(options: AppOptions = {}): Express {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '64kb' }))

  // Global rate limiter per IP: 120 req / minute
  app.use(rateLimit({ maxRequests: 120, windowMs: 60 * 1000 }))

  // Public health check routes
  app.use(healthRouter)
  app.use('/api', healthRouter)

  // Authenticated routes
  app.use(requireAuth)

  const domainsRouter = createDomainsRouter(options.prisma)
  const scansRouter = createScansRouter(options.prisma, options.scanEnqueuer)
  const findingsRouter = createFindingsRouter(options.prisma)

  app.use(domainsRouter)
  app.use('/api', domainsRouter)

  app.use(scansRouter)
  app.use('/api', scansRouter)

  app.use(findingsRouter)
  app.use('/api', findingsRouter)

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' })
  })

  // Global error handler
  app.use(errorHandler)

  return app
}
