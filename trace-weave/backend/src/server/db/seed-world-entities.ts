import { closePool } from "./pool";
import { runBuiltinWorldEntitySeed } from "../services/world-sync-service";

runBuiltinWorldEntitySeed()
  .then((result) => console.info(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);
