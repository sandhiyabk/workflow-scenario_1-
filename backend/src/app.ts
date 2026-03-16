import express from 'express';
import cors from 'cors';
import workflowRoutes from './routes/workflowRoutes.js';
import stepRoutes from './routes/stepRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import executionRoutes from './routes/executionRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import { runSeed } from './seed.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/workflows', workflowRoutes);
app.use('/steps', stepRoutes);
app.use('/rules', ruleRoutes);
app.use('/executions', executionRoutes);
app.use('/stats', statsRoutes);

// Seed endpoint — populates sample workflows for demo
app.post('/seed', async (req, res) => {
  try {
    await runSeed();
    res.json({ success: true, message: 'Sample workflows seeded successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
