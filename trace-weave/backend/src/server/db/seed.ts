import { config, quoteIdentifier } from "../config";
import { closePool, pool } from "./pool";

async function seed(): Promise<void> {
  const schema = quoteIdentifier(config.DB_SCHEMA);

  await pool.query(
    `
      INSERT INTO ${schema}.users (id, username, display_name, status)
      VALUES ($1, 'traceweave-dev', 'TraceWeave 开发用户', 'active')
      ON CONFLICT (id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          updated_at = now()
    `,
    [config.DEV_USER_ID],
  );

  await pool.query(
    `
      INSERT INTO ${schema}.privacy_policies (
        id,
        owner_user_id,
        policy_level,
        subject_key,
        content_visibility,
        allow_anonymous_stats,
        allow_matching,
        allow_identity_disclosure,
        allow_shared_occurrence,
        version
      )
      VALUES (
        '00000000-0000-4000-8000-000000000010',
        $1,
        'user_default',
        '*',
        'private',
        false,
        false,
        false,
        false,
        1
      )
      ON CONFLICT (owner_user_id, policy_level, subject_key) DO NOTHING
    `,
    [config.DEV_USER_ID],
  );

  console.info(`Seeded development user ${config.DEV_USER_ID}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);

