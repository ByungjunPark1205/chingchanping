import type { Member, Ping, Viewer } from "@/lib/types";
import { all, first } from "./db";
import type { Account } from "./auth";
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
export async function pings(receiverId?: string): Promise<Ping[]> {
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
  };
  // Explicit projection: sender IDs and private account fields never leave this function.
  const rows = await all<PingRow>(
    `SELECT c.id,c.message,c.created_at,c.category,c.receiver_id,u.chat_nickname,u.lol_nickname,u.avatar,${countSQL} AS count FROM compliments c JOIN users u ON u.id=c.receiver_id WHERE c.is_hidden=0 AND u.is_active=1${receiverId ? " AND c.receiver_id=?" : ""} ORDER BY c.created_at DESC,c.id DESC LIMIT 500`,
    ...(receiverId ? [receiverId] : []),
  );
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    category: r.category,
    createdAt: r.created_at,
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
