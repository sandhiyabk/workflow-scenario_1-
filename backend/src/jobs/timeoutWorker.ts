import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Sweeps for IN_PROGRESS executions and checks if any of their active_step_ids
 * has breached its timeout_ms limit configured in the Step metadata.
 */
export const startTimeoutWorker = () => {
  logger.info('[Timeout Worker] Started background step timeout scanner (* * * * *)');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const activeExecutions = await prisma.execution.findMany({
        where: { status: { in: ['IN_PROGRESS', 'PENDING'] } },
        include: { workflow: { include: { steps: true } } }
      });

      const now = new Date().getTime();

      for (const execution of activeExecutions) {
        // Find the earliest PENDING log for this execution to check how long it's been waiting
        const pendingLogs = await prisma.executionLog.findMany({
          where: { execution_id: execution.id, status: { in: ['IN_PROGRESS', 'PENDING'] } }
        });

        for (const log of pendingLogs) {
          const step = execution.workflow.steps.find(s => s.name === log.step_name);
          if (!step) continue;

          const metadata = step.metadata as any;
          const timeoutMs = metadata?.timeout_ms;

          if (timeoutMs) {
            const elapsed = now - new Date(log.started_at).getTime();
            
            if (elapsed > timeoutMs) {
              logger.warn(`[Timeout Worker] Step "${step.name}" in execution ${execution.id} exceeded timeout (${timeoutMs}ms). Failing execution.`);

              // Fail the log
              await prisma.executionLog.update({
                where: { id: log.id },
                data: {
                  status: 'FAILED',
                  ended_at: new Date(),
                  error_message: `Step exceeded maximum timeout of ${timeoutMs}ms`,
                  metadata: {
                    ...(log.metadata as any),
                    timeout_breached: true,
                    duration_ms: elapsed
                  }
                }
              });

              // Fail the entire execution
              await prisma.execution.update({
                where: { id: execution.id },
                data: {
                  status: 'FAILED',
                  ended_at: new Date(),
                  active_step_ids: JSON.stringify([]) as any
                }
              });

              await prisma.executionLog.create({
                data: {
                  execution_id: execution.id,
                  step_name: 'Timeout Sweeper',
                  step_type: 'SYSTEM',
                  evaluated_rules: JSON.stringify([]),
                  status: 'FAILED',
                  error_message: `Execution failed due to step "${step.name}" breaching its timeout.`,
                  started_at: new Date(),
                  ended_at: new Date()
                }
              });
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('[Timeout Worker] Error during sweep:', { error: error.message });
    }
  });
};
