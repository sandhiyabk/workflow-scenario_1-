import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ExecutionEngine } from '../engines/executionEngine.js';

const prisma = new PrismaClient();
const executionEngine = new ExecutionEngine();

export const createWorkflow = async (req: Request, res: Response) => {
  try {
    const { name, input_schema } = req.body;
    const workflow = await prisma.workflow.create({
      data: {
        name,
        input_schema,
      }
    });
    res.status(201).json(workflow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const listWorkflows = async (req: Request, res: Response) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = search ? {
      name: { contains: String(search), mode: 'insensitive' as any }
    } : {};

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { created_at: 'desc' }
      }),
      prisma.workflow.count({ where })
    ]);

    res.json({
      workflows,
      pagination: {
        total,
        pages: Math.ceil(total / Number(limit)),
        page: Number(page)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getWorkflow = async (req: Request, res: Response) => {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.id as string },
      include: {
        steps: {
          include: { rules: true },
          orderBy: { order: 'asc' }
        }
      }
    });
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateWorkflow = async (req: Request, res: Response) => {
  try {
    const { name, is_active, input_schema, start_step_id } = req.body;
    const workflow = await prisma.workflow.update({
      where: { id: req.params.id as string },
      data: {
        name,
        is_active,
        input_schema,
        start_step_id,
        version: { increment: 1 }
      }
    });
    res.json(workflow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteWorkflow = async (req: Request, res: Response) => {
  try {
    await prisma.workflow.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const executeWorkflow = async (req: Request, res: Response) => {
  try {
    const { input_data, triggered_by } = req.body;
    const execution = await executionEngine.executeWorkflow(req.params.id as string, input_data, triggered_by);
    res.json(execution);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const inputData = req.body;
    const execution = await executionEngine.executeWorkflow(
      req.params.id as string, 
      inputData, 
      `WEBHOOK_${req.ip}`
    );
    res.status(202).json({
      message: 'Workflow triggered successfully',
      execution_id: execution.id
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
