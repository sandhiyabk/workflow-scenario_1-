import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getStats = async (req: Request, res: Response) => {
  try {
    const totalWorkflows = await prisma.workflow.count();
    
    const [successfulExecutions, failedExecutions, inProgressExecutions] = await Promise.all([
      prisma.execution.count({ where: { status: 'COMPLETED' } }),
      prisma.execution.count({ where: { status: 'FAILED' } }),
      prisma.execution.count({ where: { status: 'IN_PROGRESS' } }),
    ]);

    // Calculate average execution time using sqlite raw query
    // Since prisma doesn't natively support average date diffs easily in sqlite,
    // we'll fetch recently completed executions and calculate in JS
    const recentCompleted = await prisma.execution.findMany({
      where: { status: 'COMPLETED', ended_at: { not: null } },
      select: { started_at: true, ended_at: true },
      take: 100
    });

    let averageExecutionTimeMs = 0;
    if (recentCompleted.length > 0) {
      const totalDuration = recentCompleted.reduce((sum, exec) => {
        return sum + (exec.ended_at!.getTime() - exec.started_at.getTime());
      }, 0);
      averageExecutionTimeMs = Math.round(totalDuration / recentCompleted.length);
    }

    res.json({
      totalWorkflows,
      successfulExecutions,
      failedExecutions,
      inProgressExecutions,
      averageExecutionTimeMs
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
