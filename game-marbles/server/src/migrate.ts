import { pool } from "./db";
import { env } from "./env";

async function migrate() {
  const schema = `"${env.dbSchema}"`;
  const seedRedeemCodes = [
    {
      code: "WELCOME2026",
      title: "新手补给",
      rewards: [
        { type: "coins", amount: 500 },
        { type: "marbleShard", marbleId: "basic", amount: 30 },
        { type: "gem", gemType: "power", level: 1, amount: 1 },
      ],
    },
    {
      code: "MARBLE50",
      title: "弹珠整备包",
      rewards: [
        { type: "coins", amount: 800 },
        { type: "marbleShard", marbleId: "split", amount: 20 },
        { type: "marbleShard", marbleId: "blast", amount: 20 },
        { type: "collectible", collectibleId: "ancient_chip", amount: 2 },
      ],
    },
    {
      code: "GEMSTART",
      title: "基地宝石包",
      rewards: [
        { type: "coins", amount: 300 },
        { type: "gem", gemType: "guard", level: 1, amount: 1 },
        { type: "gem", gemType: "fortune", level: 1, amount: 1 },
      ],
    },
  ];

  await pool.query(`create schema if not exists ${schema}`);
  await pool.query(`set search_path to ${schema}`);

  await pool.query(`
    create table if not exists ${schema}.gm_users (
      id uuid primary key,
      guest_id text unique,
      platform text,
      platform_uid text,
      created_at timestamptz not null default now(),
      last_login_at timestamptz not null default now(),
      banned_until timestamptz,
      status text not null default 'active'
    )
  `);

  await pool.query(`alter table ${schema}.gm_users add column if not exists nickname text`);
  await pool.query(`alter table ${schema}.gm_users add column if not exists avatar text`);
  await pool.query(`alter table ${schema}.gm_users add column if not exists username text`);
  await pool.query(`alter table ${schema}.gm_users add column if not exists password_hash text`);
  await pool.query(`alter table ${schema}.gm_users add column if not exists password_salt text`);
  await pool.query(`
    create unique index if not exists gm_users_username_lower_idx
    on ${schema}.gm_users (lower(username))
    where username is not null
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_auth_sessions (
      token_hash text primary key,
      user_id uuid not null references ${schema}.gm_users(id) on delete cascade,
      device_id text,
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_player_states (
      user_id uuid primary key references ${schema}.gm_users(id) on delete cascade,
      schema_version int not null default 1,
      revision bigint not null default 1,
      snapshot jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_idempotency_keys (
      user_id uuid not null references ${schema}.gm_users(id) on delete cascade,
      op_id text not null,
      endpoint text not null,
      response jsonb not null,
      created_at timestamptz not null default now(),
      primary key (user_id, op_id)
    )
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_leaderboard_entries (
      board_id text not null,
      season_id text not null,
      user_id uuid not null references ${schema}.gm_users(id) on delete cascade,
      score bigint not null default 0,
      sort_score bigint not null default 0,
      display_score text not null default '',
      metrics jsonb not null default '{}'::jsonb,
      nickname text not null default '',
      avatar text not null default 'avatar_green',
      risk_state text not null default 'normal',
      hidden_until timestamptz,
      updated_at timestamptz not null default now(),
      primary key (board_id, season_id, user_id)
    )
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_battle_sessions (
      id uuid primary key,
      user_id uuid not null references ${schema}.gm_users(id) on delete cascade,
      mode text not null,
      stage int not null default 1,
      config_version text not null,
      seed text not null,
      lineup_snapshot jsonb not null default '{}'::jsonb,
      state text not null default 'started',
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      client_version text,
      risk_score int not null default 0
    )
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_battle_results (
      battle_id uuid primary key references ${schema}.gm_battle_sessions(id) on delete cascade,
      result text not null,
      wave int not null,
      duration_ms int not null,
      kills int not null,
      selected_upgrades jsonb not null default '[]'::jsonb,
      client_summary jsonb not null default '{}'::jsonb,
      accepted_rewards jsonb not null default '{}'::jsonb,
      validation_flags jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_activity_definitions (
      id text primary key,
      type text not null,
      title text not null,
      starts_at timestamptz,
      ends_at timestamptz,
      status text not null default 'draft',
      rules jsonb not null default '{}'::jsonb,
      rewards jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_player_activity_states (
      user_id uuid not null references ${schema}.gm_users(id) on delete cascade,
      activity_id text not null references ${schema}.gm_activity_definitions(id) on delete cascade,
      progress jsonb not null default '{}'::jsonb,
      claimed jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now(),
      primary key (user_id, activity_id)
    )
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_redeem_codes (
      code text primary key,
      title text not null,
      status text not null default 'active',
      starts_at timestamptz,
      ends_at timestamptz,
      max_uses int,
      rewards jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists ${schema}.gm_redeem_redemptions (
      user_id uuid not null references ${schema}.gm_users(id) on delete cascade,
      code text not null references ${schema}.gm_redeem_codes(code) on delete cascade,
      rewards jsonb not null default '[]'::jsonb,
      reward_labels jsonb not null default '[]'::jsonb,
      redeemed_at timestamptz not null default now(),
      primary key (user_id, code)
    )
  `);

  for (const item of seedRedeemCodes) {
    await pool.query(
      `
        insert into ${schema}.gm_redeem_codes (code, title, status, rewards)
        values ($1, $2, 'active', $3::jsonb)
        on conflict (code) do update
        set title = excluded.title,
            status = excluded.status,
            rewards = excluded.rewards,
            updated_at = now()
      `,
      [item.code, item.title, JSON.stringify(item.rewards)],
    );
  }

  await pool.query(`create index if not exists gm_auth_sessions_user_id_idx on ${schema}.gm_auth_sessions(user_id)`);
  await pool.query(`create index if not exists gm_battle_sessions_user_id_idx on ${schema}.gm_battle_sessions(user_id, started_at desc)`);
  await pool.query(`
    create index if not exists gm_leaderboard_entries_rank_idx
    on ${schema}.gm_leaderboard_entries(board_id, season_id, sort_score desc, updated_at asc)
  `);
  await pool.query(`
    create index if not exists gm_leaderboard_entries_user_idx
    on ${schema}.gm_leaderboard_entries(user_id, board_id, season_id)
  `);
  await pool.query(`create index if not exists gm_redeem_redemptions_code_idx on ${schema}.gm_redeem_redemptions(code, redeemed_at desc)`);

  console.log(`Migrated schema ${env.dbSchema}`);
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
