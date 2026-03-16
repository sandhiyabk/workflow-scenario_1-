import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ExecutionEngine } from '../engines/executionEngine.js';

const prisma = new PrismaClient();
const executionEngine = new ExecutionEngine();

export const listExecutions = async (req: Request, res: Response) => {
  try {
    const executions = await prisma.execution.findMany({
      include: { workflow: true },
      orderBy: { started_at: 'desc' }
    });
    res.json(executions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getExecution = async (req: Request, res: Response) => {
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: req.params.id as string },
      include: { workflow: true }
    });
    if (!execution) return res.status(404).json({ error: 'Execution not found' });
    res.json(execution);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getExecutionLogs = async (req: Request, res: Response) => {
  try {
    const logs = await prisma.executionLog.findMany({
      where: { execution_id: req.params.id as string },
      orderBy: { started_at: 'asc' }
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const cancelExecution = async (req: Request, res: Response) => {
  try {
    const execution = await executionEngine.cancelExecution(req.params.id as string);
    res.json(execution);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const retryExecution = async (req: Request, res: Response) => {
  try {
    await executionEngine.retryExecution(req.params.id as string);
    res.json({ message: 'Retry initiated' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const approveStep = async (req: Request, res: Response) => {
  try {
    const { approver_id, approved, additional_data } = req.body;
    await executionEngine.resumeApproval(req.params.id as string, approver_id, approved, additional_data);
    res.json({ message: 'Approval processed' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
