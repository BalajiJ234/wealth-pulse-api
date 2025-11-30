import 'dotenv/config';
import app from './app.js';
import { config } from './config/index.js';

const startServer = async () => {
  try {
    // Future: Database connection will go here
    // await connectDatabase();

    app.listen(config.port, () => {
      console.info(`🚀 Server running on http://localhost:${config.port}`);
      console.info(`📊 Environment: ${config.nodeEnv}`);
      console.info(`❤️  Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
