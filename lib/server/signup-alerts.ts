import { env } from "cloudflare:workers";
import { all, first } from "./db";
import { fail, rateLimit } from "./auth";

// Read-only notification credential; never grants moderation or author access.
async function authorizeAlerts(req: Request, key: string) {
  const configured = env.SIGNUP_ALERT_TOKEN;
  if (!configured || !/^[a-f0-9]{64}$/.test(configured))
    return fail(503, "메일 알림 연결이 설정되지 않았어요.");
  const provided = req.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!provided) return fail(401, "메일 알림 인증이 필요해요.");
  let difference = 0;
  for (let i = 0; i < configured.length; i++) difference |= configured.charCodeAt(i) ^ provided.charCodeAt(i);
  if (difference !== 0) return fail(401, "메일 알림 인증을 확인해주세요.");
  await rateLimit(key, 12, 60000);
}

export async function pendingSignupAlerts(req: Request) {
  await authorizeAlerts(req, "signup-alert-reader");
  const pending = await all<{ id: string; chatNickname: string; createdAt: number }>(
    "SELECT id,chat_nickname AS chatNickname,created_at AS createdAt FROM users WHERE approval_status='pending' AND is_active=1 AND merged_into IS NULL ORDER BY created_at,id",
  );
  return { pending };
}

export async function newComplimentAlerts(req: Request) {
  await authorizeAlerts(req, "compliment-alert-reader");
  const value = new URL(req.url).searchParams.get("after") ?? "0";
  const after = Number(value);
  if (!/^(0|[1-9]\d{0,15})$/.test(value) || !Number.isSafeInteger(after))
    fail(400, "칭찬 알림 조회 위치를 확인해주세요.");
  const latest = (await first<{ sequence: number }>(
    "SELECT COALESCE(MAX(sequence),0) AS sequence FROM compliment_notifications",
  ))?.sequence ?? 0;
  if (after > latest) fail(400, "칭찬 알림 조회 위치를 확인해주세요.");
  // Page the registration events, including skipped records. A later restore or
  // account merge must not resend an old message, and hidden rows must not stall
  // the cursor. No sender columns are selected even for authenticated notifiers.
  const rows = await all<{
    sequence: number;
    id: string;
    message: string;
    category: string;
    createdAt: number;
    receiver: string;
    visible: number;
  }>(
    `SELECT n.sequence,c.id,c.message,c.category,c.created_at AS createdAt,
      u.chat_nickname AS receiver,
      CASE WHEN c.is_hidden=0 AND u.is_active=1 AND u.approval_status='approved'
        AND u.merged_into IS NULL THEN 1 ELSE 0 END AS visible
      FROM compliment_notifications n
      LEFT JOIN compliments c ON c.id=n.compliment_id
      LEFT JOIN users u ON u.id=c.receiver_id
      WHERE n.sequence>? AND n.sequence<=? ORDER BY n.sequence LIMIT 100`,
    after, latest,
  );
  const cursor = rows.at(-1)?.sequence ?? after;
  return {
    compliments: rows.filter((row) => row.visible === 1).map((row) => ({
      id: row.id, receiver: row.receiver, message: row.message,
      category: row.category, createdAt: row.createdAt,
    })),
    cursor,
    hasMore: cursor < latest,
  };
}
