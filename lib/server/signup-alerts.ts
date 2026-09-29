import { env } from "cloudflare:workers";
import { all } from "./db";
import { fail, rateLimit } from "./auth";

// A separate read-only credential. It cannot approve members or access reports.
export async function pendingSignupAlerts(req: Request) {
  const configured = env.SIGNUP_ALERT_TOKEN;
  if (!configured || !/^[a-f0-9]{64}$/.test(configured))
    return fail(503, "가입 알림 연결이 설정되지 않았어요.");
  const provided = req.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!provided) return fail(401, "가입 알림 인증이 필요해요.");
  let difference = 0;
  for (let i = 0; i < configured.length; i++) difference |= configured.charCodeAt(i) ^ provided.charCodeAt(i);
  if (difference !== 0) return fail(401, "가입 알림 인증을 확인해주세요.");
  await rateLimit("signup-alert-reader", 12, 60000);
  const pending = await all<{ id: string; chatNickname: string; createdAt: number }>(
    "SELECT id,chat_nickname AS chatNickname,created_at AS createdAt FROM users WHERE approval_status='pending' AND is_active=1 AND merged_into IS NULL ORDER BY created_at,id",
  );
  return { pending };
}
