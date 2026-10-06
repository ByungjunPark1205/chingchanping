import type { RankingsResponse } from "@/lib/types";
import { fail } from "./auth";
import { all } from "./db";
import { dateRange, toMember } from "./service";

export async function memberRankings(params: URLSearchParams): Promise<RankingsResponse> {
  const metric = params.get("metric") ?? "count";
  if (metric !== "count" && metric !== "likes") return fail(400, "순위 기준을 확인해주세요.");
  const { from, until } = dateRange(params);
  const filters = ["c.is_hidden=0", "u.is_active=1", "u.approval_status='approved'", "u.merged_into IS NULL"];
  const bindings: number[] = [];
  if (from !== undefined) { filters.push("c.created_at>=?"); bindings.push(from); }
  if (until !== undefined) { filters.push("c.created_at<?"); bindings.push(until); }

  // Aggregate the full DB, independently of the feed's 500-compliment limit.
  // Counting likes per compliment first avoids multiplying received counts.
  const rows = await all<{
    id: string; chat_nickname: string; lol_nickname: string; avatar: number;
    count: number; likes: number;
  }>(
    `WITH eligible AS (
      SELECT c.id,c.receiver_id FROM compliments c JOIN users u ON u.id=c.receiver_id
      WHERE ${filters.join(" AND ")}
    ), like_counts AS (
      SELECT l.compliment_id,COUNT(*) AS likes FROM compliment_likes l
      JOIN eligible c ON c.id=l.compliment_id JOIN users liker ON liker.id=l.user_id
      WHERE liker.is_active=1 AND liker.approval_status='approved' AND liker.merged_into IS NULL
      GROUP BY l.compliment_id
    )
    SELECT u.id,u.chat_nickname,u.lol_nickname,u.avatar,COUNT(c.id) AS count,COALESCE(SUM(l.likes),0) AS likes
    FROM eligible c JOIN users u ON u.id=c.receiver_id
    LEFT JOIN like_counts l ON l.compliment_id=c.id GROUP BY u.id
    ORDER BY ${metric === "count" ? "count DESC,likes DESC" : "likes DESC,count DESC"},u.chat_nickname COLLATE NOCASE,u.id`,
    ...bindings,
  );
  let previousScore = -1;
  let rank = 0;
  const rankings = rows.filter((row) => (metric === "count" ? row.count : row.likes) > 0).map((row, index) => {
    const score = metric === "count" ? row.count : row.likes;
    if (score !== previousScore) rank = index + 1;
    previousScore = score;
    return { rank, member: toMember(row), receivedCount: row.count, likesCount: row.likes };
  });
  return {
    metric, start: params.get("start"), end: params.get("end"), rankings,
    totals: rows.reduce((total, row) => ({ members: total.members + 1, pings: total.pings + row.count, likes: total.likes + row.likes }), { members: 0, pings: 0, likes: 0 }),
  };
}
