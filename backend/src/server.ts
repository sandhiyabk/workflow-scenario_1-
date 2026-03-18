import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app.js';
import { logger } from './utils/logger.js';
import { startTimeoutWorker } from './jobs/timeoutWorker.js';
import { socketManager } from './utils/socketManager.js';

const PORT = process.env.PORT || 3001;

const httpServer = createServer(app);

// Initialize Socket.io
socketManager.init(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`Workflow Engine Backend running on http://localhost:${PORT}`);
  startTimeoutWorker();
});
