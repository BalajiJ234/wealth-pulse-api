export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database config (Week 2)
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // Redis config (Week 3)
  redis: {
    url: process.env.REDIS_URL || '',
  },

  // JWT config (Future)
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: '7d',
  },
};
