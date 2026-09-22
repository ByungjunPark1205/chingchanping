import type { Member, Ping, Viewer } from "@/lib/types";
import { all, first } from "./db";
import { fail, type Account } from "./auth";
const countSQL =
  "(SELECT COUNT(*) FROM compliments c WHERE c.receiver_id=u.id AND c.is_hidden=0)";
const memberSQL = `SELECT u.id,u.chat_nickname,u.lol_nickname,u.avatar,${countSQL} AS count FROM users u`;
type Row = {
  id: string;
  chat_nickname: string;
  lol_nickname: string;
  avatar: number;
  count: number;
};
export function toMember(row: Row): Member {
  return {
    id: row.id,
    chatNickname: row.chat_nickname,
    lolNickname: row.lol_nickname,
    avatar: row.avatar,
    count: row.count,
  };
}
export async function members() {
  return (
    await all<Row>(
      `${memberSQL} WHERE u.is_active=1 ORDER BY u.chat_nickname COLLATE NOCASE LIMIT 1000`,
    )
  )
    .map(toMember)
    .sort((a, b) => a.chatNickname.localeCompare(b.chatNickname, "ko"));
}
export async function member(id: string) {
  const row = await first<Row>(
    `${memberSQL} WHERE u.id=? AND u.is_active=1`,
    id,
  );
  return row ? toMember(row) : null;
}
export async function viewer(user: Account | null): Promise<Viewer | null> {
  if (!user) return null;
  const m = await member(user.id);
  if (!m) return null;
  const count = await first<{ total: number }>(
    "SELECT COUNT(*) AS total FROM compliments WHERE receiver_id=? AND is_hidden=0 AND created_at>?",
    user.id,
    user.last_read_at,
  );
  return { ...m, role: user.role, unread: count?.total ?? 0 };
}
export function dateRange(params: URLSearchParams) {
  const start = params.get("start");
  const end = params.get("end");
  if (start === null && end === null) return {};
  const parse = (value: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return fail(400, "시작 날짜와 마지막 날짜를 모두 선택해주세요.");
    const utc = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== value)
      return fail(400, "올바른 날짜를 선택해주세요.");
    return utc - 9 * 3600000;
  };
  const from = parse(start);
  const until = parse(end) + 86400000;
  if (from >= until) fail(400, "마지막 날짜는 시작 날짜보다 빠를 수 없어요.");
  return { from, until };
}
export function startOfSeoulWeek(now = Date.now()) {
  const day = startOfSeoulDay(now);
  const weekday = new Date(day + 9 * 3600000).getUTCDay();
  return day - ((weekday + 6) % 7) * 86400000;
}
export async function pings(options: {
  receiverId?: string;
  viewerId?: string;
  from?: number;
  until?: number;
  weekly?: boolean;
} = {}): Promise<Ping[]> {
  const { receiverId, viewerId, from, until, weekly } = options;
  type PingRow = {
    id: string;
    message: string;
    created_at: number;
    category: string;
    receiver_id: string;
    chat_nickname: string;
    lol_nickname: string;
    avatar: number;
    count: number;
    likes: number;
    liked: number;
    weekly_likes: number;
  };
  // Explicit projection: sender IDs and private account fields never leave this function.
  const weekStart = startOfSeoulWeek();
  const filters = ["c.is_hidden=0", "u.is_active=1"];
  const bindings: (string | number)[] = [viewerId ?? "", weekStart, weekStart + 7 * 86400000];
  if (receiverId) { filters.push("c.receiver_id=?"); bindings.push(receiverId); }
  if (from !== undefined) { filters.push("c.created_at>=?"); bindings.push(from); }
  if (until !== undefined) { filters.push("c.created_at<?"); bindings.push(until); }
  const rows = await all<PingRow>(
    `SELECT * FROM (
      SELECT c.id,c.message,c.created_at,c.category,c.receiver_id,u.chat_nickname,u.lol_nickname,u.avatar,${countSQL} AS count,
        (SELECT COUNT(*) FROM compliment_likes l JOIN users liker ON liker.id=l.user_id WHERE l.compliment_id=c.id AND liker.is_active=1) AS likes,
        EXISTS(SELECT 1 FROM compliment_likes l WHERE l.compliment_id=c.id AND l.user_id=?) AS liked,
        (SELECT COUNT(*) FROM compliment_likes l JOIN users liker ON liker.id=l.user_id WHERE l.compliment_id=c.id AND liker.is_active=1 AND l.created_at>=? AND l.created_at<?) AS weekly_likes
      FROM compliments c JOIN users u ON u.id=c.receiver_id WHERE ${filters.join(" AND ")}
    ) ${weekly ? "WHERE weekly_likes>0 ORDER BY weekly_likes DESC,created_at DESC,id DESC LIMIT 3" : "ORDER BY created_at DESC,id DESC LIMIT 500"}`,
    ...bindings,
  );
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    category: r.category,
    createdAt: r.created_at,
    likes: r.likes,
    liked: Boolean(r.liked),
    weeklyLikes: r.weekly_likes,
    receiver: toMember({ ...r, id: r.receiver_id }),
  }));
}
export function startOfSeoulDay(now = Date.now()) {
  return Math.floor((now + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
}
export async function stats() {
  const result = await first<{ pings: number; members: number; today: number }>(
    `SELECT (SELECT COUNT(*) FROM compliments c JOIN users u ON u.id=c.receiver_id WHERE c.is_hidden=0 AND u.is_active=1) AS pings,(SELECT COUNT(*) FROM users WHERE is_active=1) AS members,(SELECT COUNT(*) FROM compliments c JOIN users u ON u.id=c.receiver_id WHERE c.is_hidden=0 AND u.is_active=1 AND c.created_at>=?) AS today`,
    startOfSeoulDay(),
  );
  return result ?? { pings: 0, members: 0, today: 0 };
}
