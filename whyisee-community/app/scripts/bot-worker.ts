import { closeDb } from "../src/server/db/client.ts";
import { processNextBotJob } from "../src/server/services/botJobs.ts";

const loop = process.env.BOT_WORKER_LOOP === "1";
const intervalMs = Number(process.env.BOT_WORKER_INTERVAL_MS || 5000);

try {
  do {
    const result = await processNextBotJob();

    if (result) {
      console.log(`[bot-worker] job ${result.id}: ${result.status}`);
    } else if (!loop) {
      console.log("[bot-worker] no queued jobs");
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
