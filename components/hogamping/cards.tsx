"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowDown, Flag, ThumbsUp } from "lucide-react";
import { time } from "@/lib/format";
import type { Ping } from "@/lib/types";
import { Avatar, PingMark, PingIcon } from "./visuals";
import { Empty, Loading } from "./common";

export function PingCard({
  ping,
  index = 0,
  example = false,
  className = "",
  onReport,
  onLike,
  rank,
}: {
  ping: Ping;
  index?: number;
  example?: boolean;
  className?: string;
  onReport?: (ping: Ping) => void;
  onLike?: (ping: Ping) => Promise<void>;
  rank?: number;
}) {
  const [liking, setLiking] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  return (
    <article
      className={`ping-card tone-${index % 3} ${!example && mountedAt - ping.createdAt < 8000 ? "fresh-ping" : ""} ${className}`}
    >
      {rank && <div className="weekly-rank">이번 주 공감 {rank}위 <span>· {ping.weeklyLikes}개</span></div>}
      <div className="card-top">
        <span className="card-category">
          <ThumbsUp size={12} />
          {ping.category}
        </span>
        <span className="card-time">
          {example ? "예시" : time(ping.createdAt)}
        </span>
      </div>
      <p className="card-message">{ping.message}</p>
      <div className="card-bottom">
        {example ? (
          <span className="card-recipient">
            <Avatar
              name={ping.receiver.chatNickname}
              index={ping.receiver.avatar}
            />
            <span>
              <b>{ping.receiver.chatNickname}</b>님에게
            </span>
          </span>
        ) : (
          <Link className="card-recipient" href={`/user/${ping.receiver.id}`}>
            <Avatar
              name={ping.receiver.chatNickname}
              index={ping.receiver.avatar}
            />
            <span>
              <b>{ping.receiver.chatNickname}</b>님에게
            </span>
          </Link>
        )}
        {example ? (
          <span className="card-ping"><PingIcon size={15} /> 칭찬핑 +1</span>
        ) : (
          <button
            className="like-button"
            aria-label={`공감해요 ${ping.likes}개`}
            aria-pressed={ping.liked}
            disabled={liking || !onLike}
            onClick={async () => {
              if (!onLike || liking) return;
              setLiking(true);
              try { await onLike(ping); } finally { setLiking(false); }
            }}
          >
            <ThumbsUp size={14} /> 공감해요 <b>{ping.likes}</b>
          </button>
        )}
      </div>
      {onReport && (
        <button className="report-button" onClick={() => onReport(ping)}>
          <Flag size={13} />
          신고
        </button>
      )}
      <PingMark className="card-marker" />
    </article>
  );
}
export function PingCollection({
  pings,
  loading,
  error,
  onReport,
  onLike,
}: {
  pings: Ping[];
  loading?: boolean;
  error?: string;
  onReport?: (p: Ping) => void;
  onLike?: (p: Ping) => Promise<void>;
}) {
  const [limit, setLimit] = useState(12);
  return loading ? (
    <Loading />
  ) : error ? (
    <Empty title="잠시 연결이 어려워요" text={error} />
  ) : !pings.length ? (
    <Empty />
  ) : (
    <>
      <div className="ping-collection">
        {pings.slice(0, limit).map((p, i) => (
          <PingCard key={p.id} ping={p} index={i} onReport={onReport} onLike={onLike} />
        ))}
      </div>
      {pings.length > limit && (
        <button className="load-more" onClick={() => setLimit((v) => v + 12)}>
          칭찬핑 더 보기 <ArrowDown size={16} />
        </button>
      )}
    </>
  );
}
