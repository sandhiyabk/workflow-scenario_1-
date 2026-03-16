import { PrismaClient } from '@prisma/client';
import { RuleEngine } from './ruleEngine.js';
import { validateInput } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
const ruleEngine = new RuleEngine();

const MAX_ITERATIONS = 100; // Increased for parallel safety

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Mock Executions ────────────────────────────────────────────
function dispatchNotification(channel: string, recipient: string, template: string, data: any): void {
  const message = template.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => data[key] ?? '');
  logger.info('[NOTIFICATION DISPATCH]', { channel, recipient, message, data });
}

function executeTask(taskName: string, action: string, data: any): Record<string, any> {
  logger.info('[TASK EXECUTION]', { taskName, action, data });
  // Simulate a possible failure for testing retries if "FAIL" is in the name
  if (taskName.includes('FAIL')) {
    throw new Error(`Simulated task failure for "${taskName}"`);
  }
  return { executed: true, task: taskName, action: action || 'default', timestamp: new Date().toISOString() };
}

export class ExecutionEngine {
  private async getExecution(executionId: string): Promise<any> {
    return prisma.execution.findUnique({
      where: { id: executionId },
      include: { workflow: { include: { steps: true } } }
    });
  }

  public async executeWorkflow(workflowId: string, inputData: any, triggeredBy?: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { order: 'asc' } } }
    });

    if (!workflow || !workflow.is_active) {
      throw new Error('Workflow not found or inactive');
    }
    if (!workflow.start_step_id) {
      throw new Error('Workflow has no start step configured');
    }

    const validation = validateInput(workflow.input_schema, inputData);
    if (!validation.valid) {
      throw new Error(`Invalid input data: ${validation.errors.join(', ')}`);
    }

    const execution = await prisma.execution.create({
      data: {
        workflow_id: workflow.id,
        workflow_version: workflow.version,
        status: 'IN_PROGRESS',
        data: inputData,
        active_step_ids: JSON.stringify([workflow.start_step_id]),
        triggered_by: triggeredBy || 'SYSTEM',
        started_at: new Date(),
      }
    });

    logger.info(`Starting execution ${execution.id} for workflow "${workflow.name}"`);

    this.processSteps(execution.id).catch(err => {
      logger.error('Unhandled error in processSteps:', { error: err.message, stack: err.stack });
    });

    return execution;
  }

  private async processSteps(executionId: string) {
    let execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { workflow: { include: { steps: true } } }
    });

    if (!execution || execution.status !== 'IN_PROGRESS') return;

    let iterations = 0;
    
    while (true) {
      iterations++;
      
      let activeStepIds: string[] = typeof (execution as any).active_step_ids === 'string' 
        ? JSON.parse((execution as any).active_step_ids) 
        : (execution as any).active_step_ids as any || [];

      if (activeStepIds.length === 0) {
        // No more active steps. Either all completed, or some are PENDING/FAILED.
        // If there are PENDING execution logs that haven't finished, the workflow is globally PENDING.
        const pendingLogs = await prisma.executionLog.count({
          where: { execution_id: executionId, status: 'PENDING' }
        });

        if (pendingLogs === 0) {
          // If none are pending, the workflow is actually complete.
          await prisma.execution.update({
            where: { id: executionId },
            data: { status: 'COMPLETED', ended_at: new Date() }
          });
          logger.info(`Execution ${executionId} COMPLETED`);
        } else {
          // It's still PENDING approvals
          await prisma.execution.update({
            where: { id: executionId },
            data: { status: 'PENDING' }
          });
        }
        break;
      }

      if (iterations > MAX_ITERATIONS) {
        await prisma.execution.update({
          where: { id: executionId },
          data: { status: 'FAILED', ended_at: new Date(), active_step_ids: JSON.stringify([]) as any }
        });
        await prisma.executionLog.create({
          data: {
            execution_id: executionId,
            step_name: 'System Guard',
            step_type: 'SYSTEM',
            evaluated_rules: JSON.stringify([]),
            status: 'FAILED',
            error_message: `Maximum iterations (${MAX_ITERATIONS}) reached — possible infinite loop`,
            started_at: new Date(),
            ended_at: new Date()
          }
        });
        break;
      }

      // We process ALL active steps concurrently for this iteration 'tick'
      const nextActiveSteps = new Set<string>();
      let anyFailed = false;

      // Note: mapping array of promises allows parallel execution of the step functions!
      await Promise.all(activeStepIds.map(async (currentStepId) => {
        const step = (execution as any).workflow.steps.find((s: any) => s.id === currentStepId);
        
        if (!step) {
          logger.warn(`Step ${currentStepId} not found — ending this branch execution with FAILED status`);
          anyFailed = true;
          await prisma.executionLog.create({
            data: {
              execution_id: executionId,
              step_name: 'Missing Step Lookup',
              step_type: 'SYSTEM',
              evaluated_rules: JSON.stringify([]),
              status: 'FAILED',
              error_message: `Referenced step ID "${currentStepId}" was not found in the workflow steps. It may have been deleted.`,
              started_at: new Date(),
              ended_at: new Date()
            }
          });
          return;
        }

        const startTime = new Date();
        let status = 'COMPLETED';
        let errorMessage: string | null = null;
        let evaluatedRules: any[] = [];
        let logMetadata: Record<string, any> = {};
        let stepNextIds: string[] = [];
        let totalAttempts = 0;

        try {
          logger.info(`Executing step: "${step.name}" (${step.step_type})`);

          // ── Step Type: APPROVAL ──────────────────────────────────────────────
          if (step.step_type === 'APPROVAL') {
            const metadata = step.metadata as any;
            const assignee = metadata?.assignee_email || metadata?.assignee || 'manager@company.com';
            const approvalMsg = metadata?.message || `Please approve step: ${step.name}`;

            await prisma.executionLog.create({
              data: {
                execution_id: executionId,
                step_name: step.name,
                step_type: step.step_type,
                evaluated_rules: JSON.stringify([]),
                selected_next_step: null,
                status: 'PENDING',
                metadata: {
                  assignee,
                  message: approvalMsg,
                  awaiting_since: new Date().toISOString()
                },
                started_at: startTime,
              }
            });

            logger.info(`⏸ Paused branch at APPROVAL step "${step.name}" — awaiting approval from ${assignee}`);
            return; // This branch ends here. It will be resumed via resumeApproval()
          }

          // ── Step Type: TASK / NOTIFICATION with Retries ───────────────────────
          const metadata = step.metadata as any;
          const maxRetries = metadata?.max_retries || 0;
          const delayMs = metadata?.delay_ms || 1000;
          const strategy = metadata?.retry_strategy || 'fixed';

          let success = false;
          let lastError = null;

          while (totalAttempts <= maxRetries && !success) {
            try {
              if (totalAttempts > 0) {
                const waitTime = strategy === 'exponential' ? delayMs * Math.pow(2, totalAttempts - 1) : delayMs;
                logger.info(`[RETRY] Step "${step.name}" attempt ${totalAttempts}/${maxRetries}. Waiting ${waitTime}ms...`);
                await sleep(waitTime);
              }

              if (step.step_type === 'NOTIFICATION') {
                const channel = metadata?.channel || 'EMAIL';
                const recipient = metadata?.assignee_email || metadata?.recipient || 'team@company.com';
                const template = metadata?.template || `Workflow step "${step.name}" has been completed.`;

                dispatchNotification(channel, recipient, template, (execution as any)!.data);
                logMetadata = { notification_channel: channel, recipient, message_template: template, dispatched_at: new Date().toISOString(), mock: true };
              }

              if (step.step_type === 'TASK') {
                const action = metadata?.action || 'execute';
                const taskResult = executeTask(step.name, action, (execution as any)!.data);
                logMetadata = { task_result: taskResult };
              }

              success = true;
            } catch (err: any) {
              totalAttempts++;
              lastError = err;
              logger.warn(`Step "${step.name}" attempt ${totalAttempts} failed: ${err.message}`);
              
              if (totalAttempts <= maxRetries) {
                // Log the retry attempt
                await prisma.executionLog.create({
                  data: {
                    execution_id: executionId,
                    step_name: `${step.name} (Retry #${totalAttempts})`,
                    step_type: 'SYSTEM',
                    evaluated_rules: JSON.stringify([]),
                    status: 'PENDING',
                    error_message: err.message,
                    metadata: { retry_attempt: totalAttempts, max_retries: maxRetries, wait_ms: strategy === 'exponential' ? delayMs * Math.pow(2, totalAttempts - 1) : delayMs },
                    started_at: new Date(),
                    ended_at: new Date()
                  }
                });
              }
            }
          }

          if (!success) {
            throw lastError || new Error(`Step "${step.name}" failed after ${maxRetries} retries`);
          }

          // ── Evaluate Routing Rules ───────────────────────────────────────────
          const rules = await prisma.rule.findMany({
            where: { step_id: currentStepId },
            orderBy: { priority: 'asc' }
          });

          for (const rule of rules) {
            const isMatch = ruleEngine.evaluate(rule.condition, (execution as any)!.data as any);
            evaluatedRules.push({
              ruleId: rule.id,
              condition: rule.condition,
              isMatch,
              nextStepId: rule.next_step_id
            });
            logger.info(`Rule: "${rule.condition}" → ${isMatch ? '✓ MATCH' : '✗ skip'}`);

            if (isMatch) {
              if (rule.next_step_id) stepNextIds.push(rule.next_step_id);
            }
          }

          if (stepNextIds.length > 0) {
             stepNextIds.forEach(id => nextActiveSteps.add(id));
          }

        } catch (error: any) {
          anyFailed = true;
          status = 'FAILED';
          errorMessage = error.message;
          logger.error(`✗ Step "${step.name}" failed:`, { error: error.message });
        } finally {
          const duration_ms = new Date().getTime() - startTime.getTime();
          
          await prisma.executionLog.create({
            data: {
              execution_id: executionId,
              step_name: step.name,
              step_type: step.step_type,
              evaluated_rules: JSON.stringify(evaluatedRules),
              selected_next_step: stepNextIds.join(','),
              status,
              error_message: errorMessage,
              metadata: { ...logMetadata, duration_ms, retry_attempts: totalAttempts },
              started_at: startTime,
              ended_at: new Date()
            }
          });
        }
      }));

      // If any of the parallel steps threw an unrecoverable failure, fail the whole execution
      if (anyFailed) {
        await prisma.execution.update({
          where: { id: executionId },
          data: { status: 'FAILED', ended_at: new Date(), active_step_ids: JSON.stringify([]) as any }
        });
        break;
      }

      // Persist the new state of active_step_ids
      const nextActiveStepsArray = Array.from(nextActiveSteps);
      
      await prisma.execution.update({
        where: { id: executionId },
        data: { active_step_ids: JSON.stringify(nextActiveStepsArray) as any }
      });

      // Refetch execution for next tick
      execution = await this.getExecution(executionId);
      
      if (!execution || (execution as any).status !== 'IN_PROGRESS') break;
    }
  }

  public async resumeApproval(executionId: string, approverId: string, approved: boolean, additionalData?: any) {
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { workflow: { include: { steps: true } } }
    });

    if (!execution || execution.status !== 'PENDING') {
      throw new Error('Execution not found or not in PENDING state');
    }

    // Find the pending approval log to know which step we are resuming
    const pendingLog = await prisma.executionLog.findFirst({
      where: {
        execution_id: executionId,
        status: 'PENDING'
      },
      orderBy: { started_at: 'desc' }
    });

    if (!pendingLog) {
      throw new Error('No pending approval found for this execution');
    }

    const currentStep = execution.workflow.steps.find((s: any) => s.name === pendingLog.step_name);
    if (!currentStep) throw new Error('Original approval step not found in workflow');

    const approvalKey = `${currentStep.name.toLowerCase().replace(/\s+/g, '_')}_approved`;
    const newData = {
      ...(execution.data as object),
      approvalResult: approved,
      [approvalKey]: approved,
      lastApprover: approverId,
      ...additionalData
    };

    // Evaluate Routing Rules for the approval step
    const rules = await prisma.rule.findMany({
      where: { step_id: currentStep.id },
      orderBy: { priority: 'asc' }
    });

    let stepNextIds: string[] = [];
    const evaluatedRules: any[] = [];
    for (const rule of rules) {
      const isMatch = ruleEngine.evaluate(rule.condition, newData as any);
      evaluatedRules.push({
        ruleId: rule.id,
        condition: rule.condition,
        isMatch,
        nextStepId: rule.next_step_id
      });
      if (isMatch && rule.next_step_id) {
        stepNextIds.push(rule.next_step_id);
      }
    }

    const duration_ms = new Date().getTime() - pendingLog.started_at.getTime();

    // Mark approval log as COMPLETED/FAILED
    await prisma.executionLog.update({
      where: { id: pendingLog.id },
      data: {
        status: approved ? 'COMPLETED' : 'FAILED',
        approver_id: approverId,
        ended_at: new Date(),
        evaluated_rules: JSON.stringify(evaluatedRules),
        selected_next_step: stepNextIds.join(','),
        metadata: {
          ...(pendingLog.metadata as object || {}),
          approved,
          approver_id: approverId,
          decided_at: new Date().toISOString(),
          decision: approved ? 'APPROVED' : 'REJECTED',
          duration_ms
        }
      }
    });

    if (!approved) {
      await prisma.execution.update({
        where: { id: executionId },
        data: { status: 'FAILED', ended_at: new Date(), active_step_ids: JSON.stringify([]) as any }
      });
      logger.info(`✗ Execution ${executionId} REJECTED by ${approverId}`);
      return;
    }

    // Add new matching paths to active_step_ids
    let activeStepIds: string[] = typeof (execution as any).active_step_ids === 'string' 
      ? JSON.parse((execution as any).active_step_ids) 
      : (execution as any).active_step_ids as any || [];
      
    stepNextIds.forEach(id => {
      if (!activeStepIds.includes(id)) activeStepIds.push(id);
    });

    await prisma.execution.update({
      where: { id: executionId },
      data: { 
        status: 'IN_PROGRESS', 
        active_step_ids: JSON.stringify(activeStepIds) as any,
        data: newData
      }
    });

    logger.info(`✓ Execution ${executionId} APPROVED by ${approverId} — resuming parallel threads`);

    // Kick off engine to consume the new active steps
    this.processSteps(executionId).catch(err => {
      logger.error('Error resuming after approval:', { error: err.message });
    });
  }

  public async cancelExecution(executionId: string) {
    const execution = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error('Execution not found');
    if (execution.status === 'COMPLETED' || execution.status === 'CANCELED') {
      throw new Error(`Cannot cancel execution with status: ${execution.status}`);
    }

    await prisma.executionLog.create({
      data: {
        execution_id: executionId,
        step_name: 'Execution Canceled',
        step_type: 'SYSTEM',
        evaluated_rules: JSON.stringify([]),
        status: 'FAILED',
        error_message: 'Execution was manually canceled',
        started_at: new Date(),
        ended_at: new Date()
      }
    });

    return prisma.execution.update({
      where: { id: executionId },
      data: { status: 'CANCELED', ended_at: new Date(), active_step_ids: JSON.stringify([]) as any }
    });
  }

  public async retryExecution(executionId: string) {
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { workflow: true }
    });

    if (!execution || execution.status !== 'FAILED') {
      throw new Error('Only FAILED executions can be retried');
    }
    if (!execution.workflow.start_step_id) {
      throw new Error('Workflow has no start step');
    }

    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'IN_PROGRESS',
        active_step_ids: JSON.stringify([execution.workflow.start_step_id]) as any,
        retries: { increment: 1 },
        ended_at: null
      }
    });

    logger.info(`Retrying execution ${executionId} (retry #${execution.retries + 1})`);

    this.processSteps(executionId).catch(err => logger.error('Error retrying workflow:', { error: err.message }));
  }
}
