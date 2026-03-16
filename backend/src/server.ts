import app from './app.js';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { startTimeoutWorker } from './jobs/timeoutWorker.js';

dotenv.config();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`Workflow Engine Backend running on http://localhost:${PORT}`);
  startTimeoutWorker();
});
