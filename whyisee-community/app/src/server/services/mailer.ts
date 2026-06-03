import net from "node:net";
import tls from "node:tls";
import { execute } from "@server/db/client";

interface EmailInput {
  to: string;
  subject: string;
  body: string;
  recipientUserId?: number;
}

export async function sendEmail(input: EmailInput) {
  const provider = getEmailProvider();
  const now = new Date().toISOString();

  await execute(
    `
    INSERT INTO email_logs (recipient_user_id, recipient_email, subject, body, provider, status, created_at)
    VALUES ($1, $2, $3, $4, $5, 'queued', $6)
    `,
    [input.recipientUserId || null, input.to, input.subject, input.body, provider, now],
  );

  if (provider === "disabled") {
    await updateLatestEmailLog(input.to, input.subject, "skipped", null);
    return;
  }

  try {
    if (provider === "smtp") {
      await sendSmtpEmail(input);
    } else {
      console.log(`[whyisee email] ${input.to} | ${input.subject}\n${input.body}`);
    }

    await updateLatestEmailLog(input.to, input.subject, "sent", null);
  } catch (error) {
    await updateLatestEmailLog(input.to, input.subject, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

function getEmailProvider() {
  const value = process.env.EMAIL_PROVIDER || process.env.EMAIL_DRIVER || "console";

  if (value === "smtp" || value === "console" || value === "disabled") {
    return value;
  }

  return "console";
}

async function updateLatestEmailLog(to: string, subject: string, status: string, error: string | null) {
  await execute(
    `
    UPDATE email_logs
    SET status = $1,
        error = $2,
        sent_at = CASE WHEN $1 = 'sent' THEN $3 ELSE sent_at END
    WHERE id = (
      SELECT id FROM email_logs
      WHERE recipient_email = $4 AND subject = $5
      ORDER BY id DESC
      LIMIT 1
    )
    `,
    [status, error, new Date().toISOString(), to, subject],
  );
}

async function sendSmtpEmail(input: EmailInput) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== "false";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || user;

  if (!host || !from) {
    throw new Error("SMTP_HOST and SMTP_FROM/SMTP_USER are required.");
  }

  const socket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });

  const client = new SmtpClient(socket);
  await client.expect(220);
  await client.command(`EHLO ${process.env.SMTP_HELO || "whyisee.xyz"}`, 250);

  if (user && pass) {
    await client.command("AUTH LOGIN", 334);
    await client.command(Buffer.from(user).toString("base64"), 334);
    await client.command(Buffer.from(pass).toString("base64"), 235);
  }

  await client.command(`MAIL FROM:<${from}>`, 250);
  await client.command(`RCPT TO:<${input.to}>`, 250);
  await client.command("DATA", 354);
  await client.write(
    [
      `From: ${from}`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.body,
      ".",
      "",
    ].join("\r\n"),
  );
  await client.expect(250);
  await client.command("QUIT", 221);
  socket.end();
}

class SmtpClient {
  private buffer = "";
  private waiters: Array<() => void> = [];

  constructor(private socket: net.Socket | tls.TLSSocket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      this.buffer += chunk;
      this.flush();
    });
  }

  async command(value: string, expectedCode: number) {
    await this.write(`${value}\r\n`);
    await this.expect(expectedCode);
  }

  async write(value: string) {
    await new Promise<void>((resolve, reject) => {
      this.socket.write(value, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async expect(expectedCode: number) {
    while (!this.hasCompleteResponse()) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    const response = this.consumeResponse();
    const code = Number(response.slice(0, 3));

    if (code !== expectedCode) {
      throw new Error(`SMTP expected ${expectedCode}, got ${response.trim()}`);
    }
  }

  private hasCompleteResponse() {
    return /(^|\r?\n)\d{3} /.test(this.buffer);
  }

  private consumeResponse() {
    const lines = this.buffer.split(/\r?\n/);
    const collected: string[] = [];

    while (lines.length > 0) {
      const line = lines.shift() || "";
      collected.push(line);

      if (/^\d{3} /.test(line)) {
        break;
      }
    }

    this.buffer = lines.join("\n");
    return collected.join("\n");
  }

  private flush() {
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) {
      waiter();
    }
  }
}
