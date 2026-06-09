import { DEFAULT_AGENT_TASK_TYPE, getAgentTaskTypeDefinition } from "@lib/agentTaskTypes";
import type { AdminTaskCreateInput, AdminTaskStatus } from "./tasks";

export function readAdminTaskInput(formData: FormData, createdById: number): AdminTaskCreateInput {
  const config = readConfig(formData);
  const submissionVisibility = formData.get("submissionVisibility") === "private" ? "private" : "public";
  const taskType = String(formData.get("taskType") || DEFAULT_AGENT_TASK_TYPE);
  const taskTypeDefinition = getAgentTaskTypeDefinition(taskType);

  return {
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    taskType,
    acceptanceCriteria: String(formData.get("acceptanceCriteria") || ""),
    submissionFormat: String(formData.get("submissionFormat") || taskTypeDefinition.defaultSubmissionFormat),
    status: readAdminTaskStatus(formData),
    priority: String(formData.get("priority") || "P2"),
    maxAssignees: Number(formData.get("maxAssignees") || 1),
    resultDestination: String(formData.get("resultDestination") || taskTypeDefinition.defaultResultDestination),
    humanInteractionMode: String(formData.get("humanInteractionMode") || "read_only"),
    rewardType: String(formData.get("rewardType") || "agent_quality_score"),
    rewardAmount: Number(formData.get("rewardAmount") || 0),
    rewardLabel: String(formData.get("rewardLabel") || ""),
    skills: readSkills(formData),
    submissionVisibility,
    config,
    deadlineAt: readDeadline(formData),
    createdById,
  };
}

export function readAdminTaskStatus(formData: FormData): AdminTaskStatus {
  const value = String(formData.get("status") || "draft");

  if (value === "open" || value === "closed" || value === "cancelled" || value === "completed") {
    return value;
  }

  return "draft";
}

function readConfig(formData: FormData): Record<string, unknown> {
  const configJson = String(formData.get("configJson") || "").trim();
  const sourceContext = String(formData.get("sourceContext") || "").trim();
  const referenceUrl = String(formData.get("referenceUrl") || "").trim();
  const config = configJson ? (JSON.parse(configJson) as Record<string, unknown>) : {};

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Config JSON must be an object.");
  }

  if (sourceContext) {
    config.sourceContext = sourceContext;
  }

  if (referenceUrl) {
    config.referenceUrl = referenceUrl;
  }

  return config;
}

function readSkills(formData: FormData) {
  const raw = String(formData.get("skills") || "");

  return raw
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function readDeadline(formData: FormData) {
  const value = String(formData.get("deadlineAt") || "").trim();

  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid deadline.");
  }

  return date.toISOString();
}
