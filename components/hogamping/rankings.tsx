"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, ThumbsUp, Trophy, Users } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import type { RankingMetric, RankingsResponse } from "@/lib/types";
import { Empty, Loading, PageHeading } from "./common";
import Link from "./link";
import { Avatar } from "./visuals";

type Period = "all" | "week" | "month" | "30days" | "custom";
const periods: { value: Period; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "week", label: "이번 주" },
  { value: "month", label: "이번 달" },
  { value: "30days", label: "최근 30일" },
  { value: "custom", label: "직접 지정" },
];
const day = 86400000;
const date = (value: number) => new Date(value).toISOString().slice(0, 10);
const number = (value: number) => value.toLocaleString("ko-KR");

function presetRange(period: Exclude<Period, "custom">) {
  if (period === "all") return { start: "", end: "" };
  // Shift to Seoul first, then use UTC calendar operations on that local date.
  const today = new Date(Date.now() + 9 * 3600000);
  const end = date(today.getTime());
  const midnight = Date.parse(`${end}T00:00:00Z`);
  const start = period === "week"
    ? date(midnight - ((today.getUTCDay() + 6) % 7) * day)
    : period === "month" ? `${end.slice(0, 7)}-01` : date(midnight - 29 * day);
  return { start, end };
}

export function RankingsView({ viewerId, onSessionExpired }: {
  viewerId: string;
  onSessionExpired: () => void;
}) {
  const [period, setPeriod] = useState<Period>("all");
  const [applied, setApplied] = useState({ start: "", end: "", metric: "count" as RankingMetric });
  const [start, setStart] = useState(() => presetRange("month").start);
  const [end, setEnd] = useState(() => presetRange("month").end);
  const [dateError, setDateError] = useState("");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: RankingsResponse; error?: string } | null>(null);
  const params = new URLSearchParams({ metric: applied.metric });
  if (applied.start && applied.end) { params.set("start", applied.start); params.set("end", applied.end); }
  const query = params.toString();
  const key = `${viewerId}:${query}:${retry}`;
  const current = result?.key === key ? result : null;
  const data = current?.data;
  const label = data?.start && data.end ? `${data.start} ~ ${data.end}` : "전체 기간";

  useEffect(() => {
    let cancelled = false;
    let sequence = 0;
    async function refresh() {
      const request = ++sequence;
      try {
        const response = await api<RankingsResponse>(`/rankings?${query}`);
        if (!cancelled && request === sequence) setResult({ key, data: response });
      } catch (error) {
        if (cancelled || request !== sequence) return;
        if (error instanceof ApiError && error.status === 401) onSessionExpired();
        else setResult({ key, error: (error as Error).message });
      }
    }
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [query, key, onSessionExpired]);

  function selectPeriod(value: Period) {
    setPeriod(value);
    setDateError("");
    if (value === "custom") return;
    const range = presetRange(value);
    setApplied((previous) => ({ ...previous, ...range }));
    if (range.start) { setStart(range.start); setEnd(range.end); }
  }

  return (
    <>
      <PageHeading eyebrow="COMMUNITY RANKING" title="칭찬핑 순위" description="원하는 기간에 칭찬을 받은 회원들의 순위를 확인해보세요." />
      <section className="ranking-filters" aria-label="순위 조회 조건">
        <div className="ranking-filter-row">
          <h2><CalendarDays size={17} /> 조회 기간</h2>
          <div className="ranking-options" role="group" aria-label="조회 기간">
            {periods.map(({ value, label }) => (
              <button key={value} type="button" aria-pressed={period === value} onClick={() => selectPeriod(value)}>{label}</button>
            ))}
          </div>
        </div>
        {period === "custom" && (
          <form className="date-range-filter ranking-date-filter" onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const from = String(fields.get("start") ?? "");
            const until = String(fields.get("end") ?? "");
            if (!from || !until || from > until) {
              setDateError("시작 날짜와 마지막 날짜를 올바른 순서로 선택해주세요.");
              return;
            }
            setDateError("");
            setStart(from);
            setEnd(until);
            setApplied((previous) => ({ ...previous, start: from, end: until }));
          }}>
            <label>시작 날짜<input type="date" name="start" defaultValue={start} required /></label>
            <span className="date-range-dash" aria-hidden="true">—</span>
            <label>마지막 날짜<input type="date" name="end" defaultValue={end} required /></label>
            <button type="submit" className="secondary-button">적용하기</button>
            <p className="date-range-hint">시작일과 마지막 날을 모두 포함해요. 날짜를 바꾼 뒤 적용해주세요.</p>
            {dateError && <p role="alert" className="form-error">{dateError}</p>}
          </form>
        )}
        <div className="ranking-filter-row">
          <h2><Trophy size={17} /> 순위 기준</h2>
          <div className="ranking-options" role="group" aria-label="순위 기준">
            <button type="button" aria-pressed={applied.metric === "count"} onClick={() => setApplied((previous) => ({ ...previous, metric: "count" }))}>받은 칭찬핑 개수</button>
            <button type="button" aria-pressed={applied.metric === "likes"} onClick={() => setApplied((previous) => ({ ...previous, metric: "likes" }))}>받은 칭찬핑의 좋아요 수</button>
          </div>
        </div>
        <p className="ranking-policy">한국 시간 기준으로 기간 안에 등록된 칭찬을 집계해요. 좋아요는 그 칭찬들에 현재 남아 있는 공감의 합계예요.</p>
      </section>
      <div className="ranking-results" aria-live="polite" aria-busy={!current}>
        {!current ? <Loading /> : current.error ? (
          <div className="error-banner" role="alert">{current.error}<button onClick={() => setRetry((value) => value + 1)}>다시 불러오기</button></div>
        ) : data && (
          <>
            <div className="ranking-result-heading"><h2>{label}</h2><span>{data.metric === "count" ? "받은 칭찬핑 개수순" : "좋아요 합계순"}</span></div>
            <div className="ranking-summary">
              <div><Users size={19} /><span>칭찬받은 회원</span><b>{number(data.totals.members)}<small>명</small></b></div>
              <div><Trophy size={19} /><span>받은 칭찬핑</span><b>{number(data.totals.pings)}<small>개</small></b></div>
              <div><ThumbsUp size={19} /><span>좋아요 합계</span><b>{number(data.totals.likes)}<small>개</small></b></div>
            </div>
            {data.rankings.length === 0 ? (
              <Empty title={data.metric === "likes" && data.totals.pings > 0 ? "아직 좋아요를 받은 칭찬핑이 없어요" : "선택한 기간에 받은 칭찬핑이 없어요"} text="다른 기간이나 순위 기준을 선택해보세요." />
            ) : (
              <div className="ranking-table-wrap">
                <table className="ranking-table">
                  <caption className="sr-only">{label} 회원별 {data.metric === "count" ? "받은 칭찬핑 개수" : "좋아요 합계"} 순위</caption>
                  <thead><tr><th scope="col">순위</th><th scope="col">회원</th><th scope="col" className={data.metric === "count" ? "ranking-sorted" : ""}>칭찬핑{data.metric === "count" && " ↓"}</th><th scope="col" className={data.metric === "likes" ? "ranking-sorted" : ""}>좋아요{data.metric === "likes" && " ↓"}</th></tr></thead>
                  <tbody>{data.rankings.map(({ rank, member, receivedCount, likesCount }) => (
                    <tr key={member.id} className={member.id === viewerId ? "ranking-self" : ""}>
                      <td><span className={`ranking-place ranking-place-${rank}`}>{rank}</span></td>
                      <td><Link className="ranking-member" href={`/user/${encodeURIComponent(member.id)}`}><Avatar name={member.chatNickname} index={member.avatar} /><span><b>{member.chatNickname}{member.id === viewerId && <em>나</em>}</b>{member.lolNickname && <small>{member.lolNickname}</small>}</span><ArrowRight size={14} /></Link></td>
                      <td className={data.metric === "count" ? "ranking-sorted" : ""}>{number(receivedCount)}<small>개</small></td>
                      <td className={data.metric === "likes" ? "ranking-sorted" : ""}>{number(likesCount)}<small>개</small></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <p className="ranking-policy">같은 점수는 공동 순위로 표시해요 (예: 1위, 1위, 3위). 선택한 기준이 0개인 회원은 순위에서 제외해요. 숨긴 칭찬과 활동이 제한된 회원의 기록·공감은 포함하지 않아요.</p>
          </>
        )}
      </div>
    </>
  );
}
