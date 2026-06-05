import { closeDb } from "../src/server/db/client.ts";
import { processDueBotTasks, processNextBotJob } from "../src/server/services/botJobs.ts";

const loop = process.env.BOT_WORKER_LOOP === "1";
const intervalMs = Number(process.env.BOT_WORKER_INTERVAL_MS || 5000);
const taskLimit = Number(process.env.BOT_WORKER_TASK_LIMIT || 1);

try {
  do {
    const taskResults = await processDueBotTasks(taskLimit);

    for (const task of taskResults) {
      console.log(`[bot-worker] task ${task.taskKey}: ${task.status}${task.outputSummary ? ` · ${task.outputSummary}` : ""}`);
    }

    const result = await processNextBotJob();

    if (result) {
      console.log(`[bot-worker] job ${result.id}: ${result.status}`);
    } else if (!loop && taskResults.length === 0) {
      console.log("[bot-worker] no queued jobs or due tasks");
    }

    if (loop) {
      await sleep(intervalMs);
    }
  } while (loop);
} finally {
  await closeDb();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
