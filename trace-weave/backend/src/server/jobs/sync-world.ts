import { closePool } from "../db/pool";
import { runWorldMaintenance } from "../services/world-sync-service";

runWorldMaintenance()
  .then((result) => console.info(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);
