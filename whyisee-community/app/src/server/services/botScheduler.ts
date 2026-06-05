import { processDueBotTasks, processNextBotJob } from "./botJobs.ts";

interface SchedulerState {
  started: boolean;
  running: boolean;
  timer?: NodeJS.Timeout;
}

declare global {
  var __whyiseeBotScheduler: SchedulerState | undefined;
}

export function startBotScheduler() {
  if (process.env.BOT_SCHEDULER_ENABLED === "0") {
    return;
  }

  const state = globalThis.__whyiseeBotScheduler || {
    started: false,
    running: false,
  };

  globalThis.__whyiseeBotScheduler = state;

  if (state.started) {
    return;
  }

  state.started = true;
  const intervalMs = readPositiveInteger(process.env.BOT_SCHEDULER_INTERVAL_MS || process.env.BOT_WORKER_INTERVAL_MS, 5000);

  state.timer = setInterval(() => {
    void runSchedulerTick(state);
  }, intervalMs);
  state.timer.unref?.();

  void runSchedulerTick(state);
}

async function runSchedulerTick(state: SchedulerState) {
  if (state.running) {
    return;
  }

  state.running = true;

  try {
    const taskLimit = readPositiveInteger(process.env.BOT_SCHEDULER_TASK_LIMIT || process.env.BOT_WORKER_TASK_LIMIT, 1);
    const taskResults = await processDueBotTasks(taskLimit);

    for (const task of taskResults) {
      console.log(`[bot-scheduler] task ${task.taskKey}: ${task.status}${task.outputSummary ? ` · ${task.outputSummary}` : ""}`);
    }

    const job = await processNextBotJob();

    if (job) {
      console.log(`[bot-scheduler] job ${job.id}: ${job.status}`);
    }
  } catch (error) {
    console.error("[bot-scheduler] tick failed", error);
  } finally {
    state.running = false;
  }
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.round(number);
}
