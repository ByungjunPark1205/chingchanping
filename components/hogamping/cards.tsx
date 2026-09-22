"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowDown, Flag, Heart, Radio } from "lucide-react";
import { time } from "@/lib/format";
import type { Ping } from "@/lib/types";
import { Avatar } from "./visuals";
import { Empty, Loading } from "./common";

export function PingCard({
  ping,
  index = 0,
  example = false,
  className = "",
  onReport,
}: {
  ping: Ping;
  index?: number;
  example?: boolean;
  className?: string;
  onReport?: (ping: Ping) => void;
}) {
  return (
    <article
      className={`ping-card tone-${index % 3} ${!example && Date.now() - ping.createdAt < 8000 ? "fresh-ping" : ""} ${className}`}
    >
      <div className="card-top">
        <span className="card-category">
          <Heart size={12} />
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
        <span className="card-ping">
          <Radio size={13} /> 호감핑 +1
        </span>
      </div>
      {onReport && (
        <button className="report-button" onClick={() => onReport(ping)}>
          <Flag size={13} />
          신고
        </button>
      )}
      <span className="card-marker" aria-hidden="true">
        <span />
      </span>
    </article>
  );
}
export function PingCollection({
  pings,
  loading,
  error,
  onReport,
}: {
  pings: Ping[];
  loading?: boolean;
  error?: string;
  onReport?: (p: Ping) => void;
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
          <PingCard key={p.id} ping={p} index={i} onReport={onReport} />
        ))}
      </div>
      {pings.length > limit && (
        <button className="load-more" onClick={() => setLimit((v) => v + 12)}>
          호감핑 더 보기 <ArrowDown size={16} />
        </button>
      )}
    </>
  );
}
