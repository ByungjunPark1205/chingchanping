import type { AdminUser, ManagedMember, MergePreview } from "@/lib/admin-types";
import { all, database, first } from "./db";
import { fail, type Account } from "./auth";

const userSQL = `SELECT u.id,u.chat_nickname AS chatNickname,u.lol_nickname AS lolNickname,
  u.created_at AS createdAt,u.is_active AS isActive,u.approval_status AS approvalStatus,
  u.merged_into AS mergedInto,m.chat_nickname AS mergedNickname,u.role,
  (SELECT COUNT(*) FROM compliments WHERE receiver_id=u.id) AS receivedCount,
  (SELECT COUNT(*) FROM compliments WHERE sender_id=u.id) AS sentCount
  FROM users u LEFT JOIN users m ON m.id=u.merged_into`;

export async function adminMembers() {
  // General member management does not expose writing activity. Transfer counts
  // are included only in the explicit account-merge preview.
  return all<ManagedMember>(`SELECT id,chatNickname,lolNickname,createdAt,isActive,approvalStatus,mergedInto,mergedNickname,role,receivedCount FROM (${userSQL}) ORDER BY createdAt DESC`);
}

async function mergePair(sourceId: string, targetId: string) {
  if (sourceId === targetId) fail(400, "서로 다른 두 계정을 선택해주세요.");
  const [source, target] = await Promise.all([
    first<AdminUser>(`${userSQL} WHERE u.id=?`, sourceId),
    first<AdminUser>(`${userSQL} WHERE u.id=?`, targetId),
  ]);
  if (!source || !target) return fail(404, "선택한 회원을 찾을 수 없어요.");
  if (source.role === "admin" || target.role === "admin") fail(403, "관리자 계정은 합칠 수 없어요.");
  if (source.mergedInto || target.mergedInto) fail(409, "이미 합쳐진 계정이에요. 회원 목록을 새로 확인해주세요.");
  if (!target.isActive || target.approvalStatus !== "approved") fail(400, "남길 계정은 승인된 활동 중 회원이어야 해요.");
  return { source, target };
}

export async function previewMerge(sourceId: string, targetId: string): Promise<MergePreview> {
  const pair = await mergePair(sourceId, targetId);
  const counts = await first<{ likes: number; duplicateLikes: number; reports: number; betweenCompliments: number }>(
    `SELECT
    (SELECT COUNT(*) FROM compliment_likes WHERE user_id=?) AS likes,
    (SELECT COUNT(*) FROM compliment_likes s JOIN compliment_likes t ON t.compliment_id=s.compliment_id WHERE s.user_id=? AND t.user_id=?) AS duplicateLikes,
    (SELECT COUNT(*) FROM reports WHERE reporter_id=?) AS reports,
    (SELECT COUNT(*) FROM compliments WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)) AS betweenCompliments`,
    sourceId, sourceId, targetId, sourceId, sourceId, targetId, targetId, sourceId,
  );
  return { ...pair, ...counts! };
}

function actionError(error: unknown): never {
  if (/member_action_invalid|UNIQUE constraint/i.test(String(error)))
    fail(409, "계정 상태나 닉네임이 변경됐어요. 회원 목록에서 다시 확인해주세요.");
  throw error;
}

export async function moderateMember(actor: Account, id: string, action: "approve" | "remove" | "restore") {
  const source = await first<AdminUser>(`${userSQL} WHERE u.id=?`, id);
  if (!source) return fail(404, "회원을 찾을 수 없어요.");
  if (id === actor.id || source.role === "admin") fail(403, "관리자 계정은 이 작업의 대상이 될 수 없어요.");
  const db = database();
  try {
    await db.batch([
      db.prepare("INSERT INTO member_actions (id,actor_id,action,source_id,source_nickname,created_at) VALUES (?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), actor.id, action, id, source.chatNickname, Date.now()),
      action === "approve"
        ? db.prepare("UPDATE users SET approval_status='approved' WHERE id=?").bind(id)
        : db.prepare("UPDATE users SET is_active=? WHERE id=?").bind(action === "restore" ? 1 : 0, id),
      ...(action === "remove" ? [db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id)] : []),
    ]);
  } catch (error) { actionError(error); }
}

export async function mergeMembers(actor: Account, sourceId: string, targetId: string, sourceName: string, targetName: string) {
  await mergePair(sourceId, targetId);
  const db = database();
  try {
    // The audit insert's trigger rechecks both accounts inside the same transaction.
    // Any failed guard or later statement rolls back the entire merge.
    await db.batch([
      db.prepare("INSERT INTO member_actions (id,actor_id,action,source_id,target_id,source_nickname,target_nickname,created_at) VALUES (?,?,'merge',?,?,?,?,?)")
        .bind(crypto.randomUUID(), actor.id, sourceId, targetId, sourceName, targetName, Date.now()),
      db.prepare("UPDATE compliments SET is_hidden=1 WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)")
        .bind(sourceId, targetId, targetId, sourceId),
      db.prepare("UPDATE compliments SET sender_id=? WHERE sender_id=?").bind(targetId, sourceId),
      db.prepare("UPDATE compliments SET receiver_id=? WHERE receiver_id=?").bind(targetId, sourceId),
      db.prepare(`INSERT INTO compliment_likes (compliment_id,user_id,created_at)
        SELECT compliment_id,?,created_at FROM compliment_likes WHERE user_id=?
        ON CONFLICT(compliment_id,user_id) DO UPDATE SET created_at=MIN(compliment_likes.created_at,excluded.created_at)`)
        .bind(targetId, sourceId),
      db.prepare("DELETE FROM compliment_likes WHERE user_id=?").bind(sourceId),
      // Preserve both reasons when the two accounts reported the same compliment.
      db.prepare(`UPDATE reports SET
        reason=reason || char(10) || '[합친 계정의 신고] ' || (SELECT s.reason FROM reports s WHERE s.reporter_id=? AND s.compliment_id=reports.compliment_id),
        status=CASE WHEN status='pending' OR EXISTS(SELECT 1 FROM reports s WHERE s.reporter_id=? AND s.compliment_id=reports.compliment_id AND s.status='pending') THEN 'pending' ELSE 'resolved' END,
        created_at=MIN(created_at,(SELECT s.created_at FROM reports s WHERE s.reporter_id=? AND s.compliment_id=reports.compliment_id))
        WHERE reporter_id=? AND EXISTS(SELECT 1 FROM reports s WHERE s.reporter_id=? AND s.compliment_id=reports.compliment_id)`)
        .bind(sourceId, sourceId, sourceId, targetId, sourceId),
      db.prepare("DELETE FROM reports WHERE reporter_id=? AND compliment_id IN (SELECT compliment_id FROM reports WHERE reporter_id=?)")
        .bind(sourceId, targetId),
      db.prepare("UPDATE reports SET reporter_id=? WHERE reporter_id=?").bind(targetId, sourceId),
      db.prepare("UPDATE users SET last_read_at=MIN(last_read_at,(SELECT last_read_at FROM users WHERE id=?)) WHERE id=?")
        .bind(sourceId, targetId),
      db.prepare("DELETE FROM sessions WHERE user_id IN (?,?)").bind(sourceId, targetId),
      db.prepare("UPDATE users SET is_active=0,merged_into=? WHERE id=?").bind(targetId, sourceId),
    ]);
  } catch (error) { actionError(error); }
}
