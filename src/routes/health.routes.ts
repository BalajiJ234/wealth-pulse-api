import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/health - Health check endpoint
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    },
  });
});

// GET /api/health/ready - Readiness check (for K8s)
router.get('/ready', (_req: Request, res: Response) => {
  // Future: Check database and redis connections
  res.json({
    success: true,
    data: {
      status: 'ready',
      checks: {
        server: true,
        database: false, // Will be implemented in Week 2
        cache: false, // Will be implemented in Week 3
      },
    },
  });
});

// GET /api/health/live - Liveness check (for K8s)
router.get('/live', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
