-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "input_schema" JSONB NOT NULL,
    "start_step_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "step_type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Step_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "step_id" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "next_step_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Rule_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "Step" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "workflow_version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "data" JSONB NOT NULL,
    "active_step_ids" JSONB NOT NULL DEFAULT [],
    "retries" INTEGER NOT NULL DEFAULT 0,
    "triggered_by" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    CONSTRAINT "Execution_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "execution_id" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "step_type" TEXT NOT NULL,
    "evaluated_rules" JSONB NOT NULL,
    "selected_next_step" TEXT,
    "status" TEXT NOT NULL,
    "approver_id" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    CONSTRAINT "ExecutionLog_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "Execution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Step_workflow_id_idx" ON "Step"("workflow_id");

-- CreateIndex
CREATE INDEX "Rule_step_id_idx" ON "Rule"("step_id");

-- CreateIndex
CREATE INDEX "Execution_workflow_id_idx" ON "Execution"("workflow_id");

-- CreateIndex
CREATE INDEX "ExecutionLog_execution_id_idx" ON "ExecutionLog"("execution_id");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
