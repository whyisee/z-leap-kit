import { notifyAdmins } from "./notifications";
import { execute, query } from "@server/db/client";

export interface ReportItem {
  id: number;
  reporterId: number;
  reporterName: string;
  targetType: string;
  targetId: number;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface ReportRow {
  id: number;
  reporter_id: number;
  reporter_name: string;
  target_type: string;
  target_id: number;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export async function createReport(input: {
  reporterId: number;
  targetType: string;
  targetId: number;
  reason: string;
  details: string;
}) {
  const now = new Date().toISOString();
  await execute(
    `
    INSERT INTO reports (reporter_id, target_type, target_id, reason, details, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'open', $6, $6)
    `,
    [input.reporterId, input.targetType, input.targetId, input.reason, input.details, now],
  );

  await notifyAdmins({
    actorId: input.reporterId,
    type: "report_created",
    targetType: input.targetType,
    targetId: input.targetId,
    title: "新的举报需要处理",
    body: `${input.targetType} #${input.targetId}: ${input.reason}`,
    href: "/admin/reports?status=open",
  });
}

export async function listReports(status = "open", limit = 100): Promise<ReportItem[]> {
  const rows = await query<ReportRow>(
    `
    SELECT
      reports.id,
      reports.reporter_id,
      users.display_name AS reporter_name,
      reports.target_type,
      reports.target_id,
      reports.reason,
      reports.details,
      reports.status,
      reports.created_at,
      reports.resolved_at
    FROM reports
    INNER JOIN users ON users.id = reports.reporter_id
    WHERE ($1 = 'all' OR reports.status = $1)
    ORDER BY reports.created_at DESC, reports.id DESC
    LIMIT $2
    `,
    [status, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
}

export async function updateReportStatus(reportId: number, status: string, actorId: number) {
  if (!["open", "accepted", "rejected", "resolved"].includes(status)) {
    throw new Error("Invalid report status.");
  }

  const now = new Date().toISOString();
  await execute(
    `
    UPDATE reports
    SET status = $1,
        resolved_by = CASE WHEN $1 = 'open' THEN NULL ELSE $2 END,
        resolved_at = CASE WHEN $1 = 'open' THEN NULL ELSE $3 END,
        updated_at = $3
    WHERE id = $4
    `,
    [status, actorId, now, reportId],
  );
}
