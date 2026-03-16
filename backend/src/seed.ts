import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function runSeed() {
  console.log('🌱 Seeding database with sample workflows...\n');

  // ════════════════════════════════════════════════════════════════════════════
  // WORKFLOW 1: Expense Approval
  // Flow: Manager Approval → (if approved & high amount) Finance Notification
  //                         → (if approved & high amount) CEO Approval
  //                         → Task Rejection (default fallback)
  // ════════════════════════════════════════════════════════════════════════════
  const expenseWorkflow = await prisma.workflow.create({
    data: {
      name: 'Expense Approval',
      input_schema: {
        amount:     { type: 'number',  required: true,  description: 'Expense amount in USD' },
        country:    { type: 'string',  required: true,  description: 'Country code (e.g. US, UK)' },
        department: { type: 'string',  required: false, description: 'Department name' },
        priority:   { type: 'string',  required: true,  description: 'Priority: High | Medium | Low',
                      allowed_values: ['High', 'Medium', 'Low'] }
      }
    }
  });

  const expManagerApproval = await prisma.step.create({
    data: {
      workflow_id: expenseWorkflow.id,
      name: 'Manager Approval',
      step_type: 'APPROVAL',
      order: 1,
      metadata: {
        assignee_email: 'manager@company.com',
        message: 'Please review and approve this expense request.',
        channel: 'EMAIL'
      }
    }
  });

  const expFinanceNotification = await prisma.step.create({
    data: {
      workflow_id: expenseWorkflow.id,
      name: 'Finance Notification',
      step_type: 'NOTIFICATION',
      order: 2,
      metadata: {
        channel: 'EMAIL',
        recipient: 'finance@company.com',
        template: 'A high-value expense of ${{amount}} from {{department}} ({{country}}) has been submitted and requires finance review.'
      }
    }
  });

  const expCeoApproval = await prisma.step.create({
    data: {
      workflow_id: expenseWorkflow.id,
      name: 'CEO Approval',
      step_type: 'APPROVAL',
      order: 3,
      metadata: {
        assignee_email: 'ceo@company.com',
        message: 'High-value expense requires CEO sign-off.',
        channel: 'EMAIL'
      }
    }
  });

  const expCompletionTask = await prisma.step.create({
    data: {
      workflow_id: expenseWorkflow.id,
      name: 'Process Payment',
      step_type: 'TASK',
      order: 4,
      metadata: {
        action: 'process_payment',
        description: 'Initiate payment processing in the finance system'
      }
    }
  });

  const expRejectionTask = await prisma.step.create({
    data: {
      workflow_id: expenseWorkflow.id,
      name: 'Send Rejection Notice',
      step_type: 'NOTIFICATION',
      order: 5,
      metadata: {
        channel: 'EMAIL',
        recipient: 'requester@company.com',
        template: 'Your expense request of ${{amount}} has been rejected. Please contact your manager for details.'
      }
    }
  });

  // Set start step
  await prisma.workflow.update({
    where: { id: expenseWorkflow.id },
    data: { start_step_id: expManagerApproval.id }
  });

  // Rules for Manager Approval step
  // Rule 1: High-value US expense → Finance Notification (priority 1)
  await prisma.rule.create({
    data: {
      step_id: expManagerApproval.id,
      condition: "amount > 100 && country == 'US' && priority == 'High'",
      next_step_id: expFinanceNotification.id,
      priority: 1
    }
  });

  // Rule 2: Amount ≤ 100 (small expense, skip finance) → Process Payment (priority 2)
  await prisma.rule.create({
    data: {
      step_id: expManagerApproval.id,
      condition: 'amount <= 100',
      next_step_id: expCompletionTask.id,
      priority: 2
    }
  });

  // Rule 3: DEFAULT → Rejection (priority 3)
  await prisma.rule.create({
    data: {
      step_id: expManagerApproval.id,
      condition: 'DEFAULT',
      next_step_id: expRejectionTask.id,
      priority: 3
    }
  });

  // Rules for Finance Notification step → go to CEO Approval
  await prisma.rule.create({
    data: {
      step_id: expFinanceNotification.id,
      condition: 'DEFAULT',
      next_step_id: expCeoApproval.id,
      priority: 1
    }
  });

  // Rules for CEO Approval step → Process Payment on approve
  await prisma.rule.create({
    data: {
      step_id: expCeoApproval.id,
      condition: 'DEFAULT',
      next_step_id: expCompletionTask.id,
      priority: 1
    }
  });

  console.log('✅ Expense Approval workflow created');

  // ════════════════════════════════════════════════════════════════════════════
  // WORKFLOW 2: Employee Onboarding
  // Flow: HR Verification (TASK) → Manager Approval (APPROVAL)
  //       → Account Creation (TASK) → Welcome Email (NOTIFICATION)
  // ════════════════════════════════════════════════════════════════════════════
  const onboardingWorkflow = await prisma.workflow.create({
    data: {
      name: 'Employee Onboarding',
      input_schema: {
        employee_name: { type: 'string',  required: true,  description: 'Full name of the new employee' },
        department:    { type: 'string',  required: true,  description: 'Department they are joining' },
        role:          { type: 'string',  required: true,  description: 'Job role / title' },
        hr_verified:   { type: 'boolean', required: true,  description: 'Has HR completed background verification?' },
        start_date:    { type: 'string',  required: false, description: 'Expected start date (YYYY-MM-DD)' }
      }
    }
  });

  const hrVerification = await prisma.step.create({
    data: {
      workflow_id: onboardingWorkflow.id,
      name: 'HR Verification',
      step_type: 'TASK',
      order: 1,
      metadata: {
        action: 'run_background_check',
        description: 'Run background check and verify employment documents',
        assignee: 'hr-team@company.com'
      }
    }
  });

  const managerApproval = await prisma.step.create({
    data: {
      workflow_id: onboardingWorkflow.id,
      name: 'Manager Approval',
      step_type: 'APPROVAL',
      order: 2,
      metadata: {
        assignee_email: 'manager@company.com',
        message: 'Please approve the onboarding of {{employee_name}} for the {{role}} role in {{department}}.',
        channel: 'EMAIL'
      }
    }
  });

  const accountCreation = await prisma.step.create({
    data: {
      workflow_id: onboardingWorkflow.id,
      name: 'Create Employee Account',
      step_type: 'TASK',
      order: 3,
      metadata: {
        action: 'create_account',
        description: 'Create email account, provision access, set up workstation',
        systems: ['email', 'slack', 'github', 'jira']
      }
    }
  });

  const welcomeEmail = await prisma.step.create({
    data: {
      workflow_id: onboardingWorkflow.id,
      name: 'Send Welcome Email',
      step_type: 'NOTIFICATION',
      order: 4,
      metadata: {
        channel: 'EMAIL',
        recipient: 'employee_name@company.com',
        template: 'Welcome to the team, {{employee_name}}! You are joining {{department}} as {{role}}. Your accounts have been provisioned and you are all set for your start date.'
      }
    }
  });

  const rejectionNotification = await prisma.step.create({
    data: {
      workflow_id: onboardingWorkflow.id,
      name: 'Notify HR - Verification Failed',
      step_type: 'NOTIFICATION',
      order: 5,
      metadata: {
        channel: 'EMAIL',
        recipient: 'hr@company.com',
        template: 'Onboarding for {{employee_name}} could not proceed. HR verification was not confirmed.'
      }
    }
  });

  // Set start step
  await prisma.workflow.update({
    where: { id: onboardingWorkflow.id },
    data: { start_step_id: hrVerification.id }
  });

  // Rules for HR Verification
  // If HR verified → Manager Approval
  await prisma.rule.create({
    data: {
      step_id: hrVerification.id,
      condition: 'hr_verified == true',
      next_step_id: managerApproval.id,
      priority: 1
    }
  });
  // DEFAULT (not verified) → Rejection notification
  await prisma.rule.create({
    data: {
      step_id: hrVerification.id,
      condition: 'DEFAULT',
      next_step_id: rejectionNotification.id,
      priority: 2
    }
  });

  // Rules for Manager Approval → Account Creation
  await prisma.rule.create({
    data: {
      step_id: managerApproval.id,
      condition: 'DEFAULT',
      next_step_id: accountCreation.id,
      priority: 1
    }
  });

  // Rules for Account Creation → Welcome Email
  await prisma.rule.create({
    data: {
      step_id: accountCreation.id,
      condition: 'DEFAULT',
      next_step_id: welcomeEmail.id,
      priority: 1
    }
  });

  // Welcome Email has no next step → workflow ends

  // ════════════════════════════════════════════════════════════════════════════
  // WORKFLOW 3: Reliable Data Sync (Retry & Timeout Demo)
  // ════════════════════════════════════════════════════════════════════════════
  const syncWorkflow = await prisma.workflow.create({
    data: {
      name: 'Reliable Data Sync',
      input_schema: {
        sync_id: { type: 'string', required: true },
        priority: { type: 'number', required: false }
      }
    }
  });

  const flakeyStep = await prisma.step.create({
    data: {
      workflow_id: syncWorkflow.id,
      name: 'Fetch Remote Data (FAIL)', // "FAIL" in name triggers mock failure in ExecutionEngine
      step_type: 'TASK',
      order: 1,
      metadata: {
        action: 'fetch_data',
        max_retries: 3,
        delay_ms: 1000,
        retry_strategy: 'exponential',
        timeout_ms: 5000
      }
    }
  });

  const finalSyncStep = await prisma.step.create({
    data: {
      workflow_id: syncWorkflow.id,
      name: 'Finalize Sync',
      step_type: 'NOTIFICATION',
      order: 2,
      metadata: {
        channel: 'SLACK',
        recipient: '#ops-channel',
        template: 'Data sync {{sync_id}} completed after retries.'
      }
    }
  });

  await prisma.workflow.update({
    where: { id: syncWorkflow.id },
    data: { start_step_id: flakeyStep.id }
  });

  await prisma.rule.create({
    data: {
      step_id: flakeyStep.id,
      condition: 'DEFAULT',
      next_step_id: finalSyncStep.id,
      priority: 1
    }
  });

  console.log('✅ Reliable Data Sync workflow created\n');
  console.log('🎉 Seeding completed successfully!');
  console.log('   • Expense Approval     — ID:', expenseWorkflow.id);
  console.log('   • Employee Onboarding  — ID:', onboardingWorkflow.id);
  console.log('   • Reliable Data Sync   — ID:', syncWorkflow.id);
}

// Allow running directly via: npm run seed
runSeed()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
