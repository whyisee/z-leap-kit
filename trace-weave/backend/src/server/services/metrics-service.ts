import { config, quoteIdentifier } from "../config";
import { pool } from "../db/pool";

const schema = quoteIdentifier(config.DB_SCHEMA);
const requests = new Map<string, { count: number; errors: number; durationMs: number }>();

export function observeHttpRequest(input: { method: string; route: string; statusCode: number; durationMs: number }) {
  const key = `${input.method}|${input.route}`;
  const current = requests.get(key) ?? { count: 0, errors: 0, durationMs: 0 };
  current.count += 1;
  current.durationMs += input.durationMs;
  if (input.statusCode >= 500) current.errors += 1;
  requests.set(key, current);
}

function label(value: string) { return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n"); }

export async function prometheusMetrics(): Promise<string> {
  const queue = await pool.query<{
    outboxPending: number; outboxDead: number; deletionPending: number; deletionFailed: number; pushFailed: number;
    publicEvents: number; publicEntityEdges: number; worldSyncAgeSeconds: number;
  }>(
    `SELECT
       (SELECT count(*) FROM ${schema}.outbox_events WHERE published_at IS NULL AND dead_lettered_at IS NULL)::int AS "outboxPending",
       (SELECT count(*) FROM ${schema}.outbox_events WHERE dead_lettered_at IS NOT NULL)::int AS "outboxDead",
       (SELECT count(*) FROM ${schema}.deletion_jobs WHERE status IN ('pending','processing'))::int AS "deletionPending",
       (SELECT count(*) FROM ${schema}.deletion_jobs WHERE status = 'failed')::int AS "deletionFailed",
       (SELECT count(*) FROM ${schema}.web_push_deliveries WHERE status = 'failed')::int AS "pushFailed",
       (SELECT count(*) FROM ${schema}.public_event_projections)::int AS "publicEvents",
       (SELECT count(*) FROM ${schema}.public_event_entity_projections)::int AS "publicEntityEdges",
       COALESCE((SELECT extract(epoch FROM now()-last_success_at)::int
                 FROM ${schema}.world_sync_state WHERE source_key='public_graph'),-1) AS "worldSyncAgeSeconds"`,
  );
  const lines = [
    "# TYPE traceweave_http_requests_total counter",
    "# TYPE traceweave_http_errors_total counter",
    "# TYPE traceweave_http_request_duration_ms_total counter",
  ];
  for (const [key, value] of requests) {
    const [method, route] = key.split("|");
    const labels = `method="${label(method)}",route="${label(route)}"`;
    lines.push(`traceweave_http_requests_total{${labels}} ${value.count}`);
    lines.push(`traceweave_http_errors_total{${labels}} ${value.errors}`);
    lines.push(`traceweave_http_request_duration_ms_total{${labels}} ${value.durationMs.toFixed(3)}`);
  }
  const gauges = queue.rows[0];
  lines.push("# TYPE traceweave_queue_items gauge");
  for (const [queueName, value] of Object.entries({
    outboxPending: gauges.outboxPending,
    outboxDead: gauges.outboxDead,
    deletionPending: gauges.deletionPending,
    deletionFailed: gauges.deletionFailed,
    pushFailed: gauges.pushFailed,
  })) lines.push(`traceweave_queue_items{queue="${label(queueName)}"} ${value}`);
  lines.push("# TYPE traceweave_public_graph_items gauge");
  lines.push(`traceweave_public_graph_items{kind="events"} ${gauges.publicEvents}`);
  lines.push(`traceweave_public_graph_items{kind="entity_edges"} ${gauges.publicEntityEdges}`);
  lines.push("# TYPE traceweave_world_sync_age_seconds gauge");
  lines.push(`traceweave_world_sync_age_seconds ${gauges.worldSyncAgeSeconds}`);
  lines.push(`# TYPE traceweave_db_pool_total gauge`, `traceweave_db_pool_total ${pool.totalCount}`);
  lines.push(`# TYPE traceweave_db_pool_idle gauge`, `traceweave_db_pool_idle ${pool.idleCount}`);
  lines.push(`# TYPE traceweave_db_pool_waiting gauge`, `traceweave_db_pool_waiting ${pool.waitingCount}`);
  return `${lines.join("\n")}\n`;
}
