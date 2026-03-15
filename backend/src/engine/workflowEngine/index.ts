import { PrismaClient } from '@prisma/client';
import { RuleEngine } from '../ruleEngine/index.js';
import { validateInput } from '../../utils/validator.js';

const prisma = new PrismaClient();
const ruleEngine = new RuleEngine();

const MAX_ITERATIONS = 50; // Prevent infinite loops

// ─── Mock Notification Dispatcher ────────────────────────────────────────────
function dispatchNotification(channel: string, recipient: string, template: string, data: any): void {
  const message = template.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => data[key] ?? '');
  console.log(`\n[NOTIFICATION DISPATCH]`);
  console.log(`  Channel  : ${channel}`);
  console.log(`  Recipient: ${recipient}`);
  console.log(`  Message  : ${message}`);
  console.log(`  Payload  :`, JSON.stringify(data, null, 2));
}

// ─── Mock Task Executor ───────────────────────────────────────────────────────
function executeTask(taskName: string, action: string, data: any): Record<string, any> {
  console.log(`\n[TASK EXECUTION]`);
  console.log(`  Task  : ${taskName}`);
  console.log(`  Action: ${action || 'default'}`);
  console.log(`  Data  :`, JSON.stringify(data, null, 2));
  // In a real system: call external API, update DB records, generate reports, etc.
  return { executed: true, task: taskName, action: action || 'default', timestamp: new Date().toISOString() };
}

export class WorkflowEngine {
  /**
   * Starts a new workflow execution
   */
  public async executeWorkflow(workflowId: string, inputData: any, triggeredBy?: string) {
    // 1. Load Workflow with Steps
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

    // 2. Validate Input Schema
    const validation = validateInput(workflow.input_schema, inputData);
    if (!validation.valid) {
      throw new Error(`Invalid input data: ${validation.errors.join(', ')}`);
    }

    // 3. Create Execution Record
    const execution = await prisma.execution.create({
      data: {
        workflow_id: workflow.id,
        workflow_version: workflow.version,
        status: 'IN_PROGRESS',
        data: inputData,
        current_step_id: workflow.start_step_id,
        triggered_by: triggeredBy || 'SYSTEM',
        started_at: new Date(),
      }
    });

    console.log(`\n[WORKFLOW ENGINE] Starting execution ${execution.id} for workflow "${workflow.name}"`);

    // 4. Begin step processing (async — non-blocking)
    this.processSteps(execution.id).catch(err => {
      console.error(`[WORKFLOW ENGINE] Unhandled error in processSteps:`, err);
    });

    return execution;
  }

  /**
   * Core execution loop — runs through steps until end or APPROVAL pause
   */
  private async processSteps(executionId: string) {
    let execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { workflow: { include: { steps: true } } }
    });

    if (!execution || execution.status !== 'IN_PROGRESS') return;

    let currentStepId = execution.current_step_id;
    let iterations = 0;

    while (currentStepId) {
      iterations++;

      // ── Guard: Infinite Loop Protection ────────────────────────────────────
      if (iterations > MAX_ITERATIONS) {
        await prisma.execution.update({
          where: { id: executionId },
          data: { status: 'FAILED', ended_at: new Date() }
        });
        await prisma.executionLog.create({
          data: {
            execution_id: executionId,
            step_name: 'System Guard',
            step_type: 'SYSTEM',
            evaluated_rules: [],
            status: 'FAILED',
            error_message: `Maximum iterations (${MAX_ITERATIONS}) reached — possible infinite loop`,
            started_at: new Date(),
            ended_at: new Date()
          }
        });
        return;
      }

      const step = execution.workflow.steps.find((s: any) => s.id === currentStepId);
      if (!step) {
        console.warn(`[WORKFLOW ENGINE] Step ${currentStepId} not found — ending execution with FAILED status`);
        await prisma.execution.update({
          where: { id: executionId },
          data: { status: 'FAILED', ended_at: new Date() }
        });
        await prisma.executionLog.create({
          data: {
            execution_id: executionId,
            step_name: 'Missing Step Lookup',
            step_type: 'SYSTEM',
            evaluated_rules: [],
            status: 'FAILED',
            error_message: `Referenced step ID "${currentStepId}" was not found in the workflow steps. It may have been deleted.`,
            started_at: new Date(),
            ended_at: new Date()
          }
        });
        break;
      }

      const startTime = new Date();
      let nextStepId: string | null = null;
      let status = 'COMPLETED';
      let errorMessage: string | null = null;
      let evaluatedRules: any[] = [];
      let logMetadata: Record<string, any> = {};

      try {
        console.log(`\n[WORKFLOW ENGINE] Executing step: "${step.name}" (${step.step_type})`);

        // ── Step Type: APPROVAL ──────────────────────────────────────────────
        if (step.step_type === 'APPROVAL') {
          const metadata = step.metadata as any;
          const assignee = metadata?.assignee_email || metadata?.assignee || 'manager@company.com';
          const approvalMsg = metadata?.message || `Please approve step: ${step.name}`;

          // Log the approval request
          await prisma.executionLog.create({
            data: {
              execution_id: executionId,
              step_name: step.name,
              step_type: step.step_type,
              evaluated_rules: [],
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

          // Pause execution — resume via resumeApproval()
          await prisma.execution.update({
            where: { id: executionId },
            data: {
              status: 'PENDING',
              current_step_id: step.id
            }
          });

          console.log(`[WORKFLOW ENGINE] ⏸ Paused at APPROVAL step "${step.name}" — awaiting approval from ${assignee}`);
          return; // EXIT loop — will resume via resumeApproval()
        }

        // ── Step Type: NOTIFICATION ──────────────────────────────────────────
        if (step.step_type === 'NOTIFICATION') {
          const metadata = step.metadata as any;
          const channel = metadata?.channel || 'EMAIL';
          const recipient = metadata?.assignee_email || metadata?.recipient || 'team@company.com';
          const template = metadata?.template || `Workflow step "${step.name}" has been completed.`;

          // Dispatch the notification (mock)
          dispatchNotification(channel, recipient, template, execution.data as any);

          logMetadata = {
            notification_channel: channel,
            recipient,
            message_template: template,
            dispatched_at: new Date().toISOString(),
            mock: true // In prod: replace with real email/Slack SDK
          };
        }

        // ── Step Type: TASK ──────────────────────────────────────────────────
        if (step.step_type === 'TASK') {
          const metadata = step.metadata as any;
          const action = metadata?.action || 'execute';
          const taskResult = executeTask(step.name, action, execution.data);
          logMetadata = { task_result: taskResult };
        }

        // ── Evaluate Routing Rules ───────────────────────────────────────────
        const rules = await prisma.rule.findMany({
          where: { step_id: currentStepId as string },
          orderBy: { priority: 'asc' }
        });

        nextStepId = null;

        for (const rule of rules) {
          const isMatch = ruleEngine.evaluate(rule.condition, execution.data as any);

          evaluatedRules.push({
            ruleId: rule.id,
            condition: rule.condition,
            isMatch,
            nextStepId: rule.next_step_id
          });

          console.log(`  Rule: "${rule.condition}" → ${isMatch ? '✓ MATCH' : '✗ skip'}`);

          if (isMatch) {
            nextStepId = rule.next_step_id;
            break;
          }
        }

        if (rules.length === 0) {
          console.log(`  No rules — step ends workflow`);
        }

      } catch (error: any) {
        status = 'FAILED';
        errorMessage = error.message;

        await prisma.execution.update({
          where: { id: executionId },
          data: { status: 'FAILED', ended_at: new Date() }
        });

        await prisma.executionLog.create({
          data: {
            execution_id: executionId,
            step_name: step.name,
            step_type: step.step_type,
            evaluated_rules: evaluatedRules,
            selected_next_step: null,
            status,
            error_message: errorMessage,
            metadata: logMetadata,
            started_at: startTime,
            ended_at: new Date()
          }
        });

        console.error(`[WORKFLOW ENGINE] ✗ Step "${step.name}" failed:`, error.message);
        return;
      }

      // ── Write Execution Log ──────────────────────────────────────────────
      await prisma.executionLog.create({
        data: {
          execution_id: executionId,
          step_name: step.name,
          step_type: step.step_type,
          evaluated_rules: evaluatedRules,
          selected_next_step: nextStepId,
          status,
          metadata: logMetadata,
          started_at: startTime,
          ended_at: new Date()
        }
      });

      // ── Advance State ────────────────────────────────────────────────────
      const isComplete = !nextStepId;
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          current_step_id: nextStepId,
          status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
          ended_at: isComplete ? new Date() : null
        }
      });

      if (isComplete) {
        console.log(`[WORKFLOW ENGINE] ✓ Execution ${executionId} COMPLETED`);
        break;
      }

      currentStepId = nextStepId;

      // Re-fetch execution for fresh data (important for approval-injected fields)
      execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: { workflow: { include: { steps: true } } }
      }) as any;

      if (!execution || execution.status !== 'IN_PROGRESS') break;
    }
  }

  /**
   * Resume an execution that is PENDING at an APPROVAL step
   */
  public async resumeApproval(executionId: string, approverId: string, approved: boolean, additionalData?: any) {
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { workflow: { include: { steps: true } } }
    });

    if (!execution || execution.status !== 'PENDING') {
      throw new Error('Execution not found or not in PENDING state');
    }

    const currentStep = execution.workflow.steps.find((s: any) => s.id === execution.current_step_id);
    if (!currentStep || currentStep.step_type !== 'APPROVAL') {
      throw new Error('Current step is not an APPROVAL step');
    }

    const approvalKey = `${currentStep.name.toLowerCase().replace(/\s+/g, '_')}_approved`;
    const newData = {
      ...(execution.data as object),
      approvalResult: approved,
      [approvalKey]: approved,
      lastApprover: approverId,
      ...additionalData
    };

    // Evaluate Routing Rules to find next step
    const rules = await prisma.rule.findMany({
      where: { step_id: currentStep.id },
      orderBy: { priority: 'asc' }
    });

    let nextStepId: string | null = null;
    const evaluatedRules: any[] = [];
    for (const rule of rules) {
      const isMatch = ruleEngine.evaluate(rule.condition, newData as any);
      evaluatedRules.push({
        ruleId: rule.id,
        condition: rule.condition,
        isMatch,
        nextStepId: rule.next_step_id
      });
      if (isMatch) {
        nextStepId = rule.next_step_id;
        break;
      }
    }

    // Update approval log entry to record decision and routing
    const pendingLog = await prisma.executionLog.findFirst({
      where: {
        execution_id: executionId,
        step_name: currentStep.name,
        status: 'PENDING'
      },
      orderBy: { started_at: 'desc' }
    });

    if (pendingLog) {
      await prisma.executionLog.update({
        where: { id: pendingLog.id },
        data: {
          status: approved ? 'COMPLETED' : 'FAILED',
          approver_id: approverId,
          ended_at: new Date(),
          evaluated_rules: evaluatedRules,
          selected_next_step: nextStepId,
          metadata: {
            ...(pendingLog.metadata as object || {}),
            approved,
            approver_id: approverId,
            decided_at: new Date().toISOString(),
            decision: approved ? 'APPROVED' : 'REJECTED'
          }
        }
      });
    }

    // If rejected, mark execution as failed
    if (!approved) {
      await prisma.execution.update({
        where: { id: executionId },
        data: { status: 'FAILED', ended_at: new Date() }
      });
      console.log(`[WORKFLOW ENGINE] ✗ Execution ${executionId} REJECTED by ${approverId}`);
      return;
    }

    // If approved, advance to the next step and resume
    const isComplete = !nextStepId;
    await prisma.execution.update({
      where: { id: executionId },
      data: { 
        status: isComplete ? 'COMPLETED' : 'IN_PROGRESS', 
        current_step_id: nextStepId,
        data: newData,
        ended_at: isComplete ? new Date() : null
      }
    });

    console.log(`[WORKFLOW ENGINE] ✓ Execution ${executionId} APPROVED by ${approverId} — advancing to ${nextStepId || 'END'}`);

    if (isComplete) return;

    // Continue from next step
    this.processSteps(executionId).catch(err => {
      console.error(`[WORKFLOW ENGINE] Error resuming after approval:`, err);
    });
  }

  /**
   * Cancel a running/pending execution
   */
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
        evaluated_rules: [],
        status: 'FAILED',
        error_message: 'Execution was manually canceled',
        started_at: new Date(),
        ended_at: new Date()
      }
    });

    return prisma.execution.update({
      where: { id: executionId },
      data: { status: 'CANCELED', ended_at: new Date() }
    });
  }

  /**
   * Retry a FAILED execution from the beginning
   */
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
        current_step_id: execution.workflow.start_step_id,
        retries: { increment: 1 },
        ended_at: null
      }
    });

    this.processSteps(executionId).catch(err => {
      console.error(`[WORKFLOW ENGINE] Error during retry:`, err);
    });

    console.log(`[WORKFLOW ENGINE] Retrying execution ${executionId} (retry #${(execution.retries ?? 0) + 1})`);
  }
}
