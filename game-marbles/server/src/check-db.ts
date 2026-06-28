import { pool } from "./db";
import { env } from "./env";

async function checkDb() {
  const result = await pool.query("select now() as now");
  console.log(`Connected to ${env.dbHost}:${env.dbPort}/${env.dbName} schema=${env.dbSchema} at ${result.rows[0].now.toISOString()}`);
}

checkDb()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
