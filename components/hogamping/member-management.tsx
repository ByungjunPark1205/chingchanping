"use client";
import { useState } from "react";
import { Search, ArrowRight, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import type { ManagedMember, MemberAction, MergePreview } from "@/lib/admin-types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Empty } from "./common";

const status = (u: ManagedMember) => u.mergedInto ? "merged" : !u.isActive ? "removed" : u.approvalStatus === "pending" ? "pending" : "active";
const labels: Record<string, string> = { active: "활동 중", pending: "승인 대기", removed: "내보냄", merged: "합쳐짐" };
const actionLabels = { approve: "가입 승인", remove: "내보내기", restore: "이용 복구", merge: "계정 합치기", promote: "관리자 지정" };

export function MemberManagement({ users, actions, busy, onAction, onMerged }: {
  users: ManagedMember[];
  actions: MemberAction[];
  busy: boolean;
  onAction: (kind: string, user: ManagedMember) => void;
  onMerged: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const matches = users.filter((u) => (filter === "all" || status(u) === filter) && `${u.chatNickname} ${u.lolNickname}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <>
    <div className="member-summary" aria-label="회원 현황">
      {Object.entries(labels).map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
        <span>{label}</span><b>{users.filter((u) => status(u) === key).length}명</b>
      </button>)}
    </div>
    <p className="member-policy">새 회원은 가입 승인 후 활동할 수 있어요. 닉네임이 달라도 같은 사람인지 확인한 뒤 계정을 합쳐주세요.</p>
    <div className="member-filters">
      <label className="member-search-label"><Search size={17} /><input aria-label="회원 닉네임 검색" placeholder="닉네임 검색" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <label><span className="sr-only">회원 상태</span><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">전체 회원</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    {!matches.length ? <Empty title="해당하는 회원이 없어요" text="검색어나 회원 상태를 변경해보세요." /> : <div className="admin-users">
      {matches.map((u) => <article className="admin-record" key={u.id}>
        <div className="admin-record-head"><b>{u.chatNickname}</b><span className={`member-status status-${status(u)}`}>{u.role === "admin" ? "관리자" : labels[status(u)]}</span></div>
        {u.lolNickname && <p>{u.lolNickname}</p>}
        <p className="member-counts">받은 칭찬 {u.receivedCount}개</p>
        <small>가입일 {new Date(u.createdAt).toLocaleDateString("ko-KR")}</small>
        {u.mergedInto ? <p>{u.mergedNickname} 계정으로 합쳐졌어요.</p> : u.role !== "admin" && <div className="admin-actions member-buttons">
          {u.isActive && u.approvalStatus === "pending" ? <button disabled={busy} className="primary-button" onClick={() => onAction("approve", u)}>가입 승인</button> : null}
          {u.isActive && u.approvalStatus === "approved" ? <button disabled={busy} className="text-button" onClick={() => onAction("promote", u)}>관리자 지정</button> : null}
          <button disabled={busy} className="secondary-button" onClick={() => onAction(u.isActive ? "deactivate" : "activate", u)}>{u.isActive ? "내보내기" : "이용 복구"}</button>
          <button disabled={busy} className="text-button" onClick={() => setSourceId(u.id)}>다른 계정에 합치기</button>
        </div>}
      </article>)}
    </div>}
    <section className="member-history" aria-label="최근 회원 관리 기록">
      <h2>최근 처리 기록</h2>
      {actions.length === 0 ? <p className="muted">아직 처리 기록이 없어요.</p> : <ol>{actions.map((a) => <li key={a.id}>
        <div><b>{actionLabels[a.action]}</b><span>{a.sourceNickname}{a.targetNickname ? ` → ${a.targetNickname}` : ""}</span></div>
        <small>{a.actor} · {new Date(a.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</small>
      </li>)}</ol>}
    </section>
    {sourceId && <MergeMembers key={sourceId} users={users} sourceId={sourceId} onClose={() => setSourceId(null)} onMerged={onMerged} />}
  </>;
}

function MergeMembers({ users, sourceId, onClose, onMerged }: { users: ManagedMember[]; sourceId: string; onClose: () => void; onMerged: () => Promise<void> }) {
  const source = users.find((u) => u.id === sourceId)!;
  const [targetId, setTargetId] = useState("");
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targets = users.filter((u) => u.id !== sourceId && u.role !== "admin" && status(u) === "active");
  async function inspect() {
    setBusy(true); setError("");
    try { setPreview(await api(`/admin/merge-preview?source=${encodeURIComponent(sourceId)}&target=${encodeURIComponent(targetId)}`)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function merge() {
    if (!preview || !confirmed) return;
    setBusy(true); setError("");
    try {
      await api("/admin/merge", { sourceId, targetId, sourceNickname: preview.source.chatNickname, targetNickname: preview.target.chatNickname });
      await onMerged();
      toast.success(`${preview.target.chatNickname} 계정으로 합쳤어요.`);
      onClose();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="hogam-dialog merge-dialog" showCloseButton={!busy}>
      <DialogTitle>중복 계정 합치기</DialogTitle>
      <DialogDescription>같은 사람이 만든 계정인 경우에만 진행해주세요. 합친 후에는 이 화면에서 되돌릴 수 없어요.</DialogDescription>
      {!preview ? <>
        <div className="merge-direction"><span><small>합칠 계정</small><b>{source.chatNickname}</b></span><ArrowRight size={20} /><span><small>남길 계정</small><b>{users.find((u) => u.id === targetId)?.chatNickname ?? "선택해주세요"}</b></span></div>
        <label className="merge-target-label">남길 닉네임<select aria-label="남길 닉네임" value={targetId} onChange={(e) => { setTargetId(e.target.value); setError(""); }} disabled={busy}><option value="">계정 선택</option>{targets.map((u) => <option key={u.id} value={u.id}>{u.chatNickname}</option>)}</select></label>
        {!targets.length && <p className="muted">합칠 수 있는 다른 활동 중 회원이 없어요. 승인 대기 중인 계정은 먼저 승인해주세요.</p>}
        <button className="primary-button full" disabled={!targetId || busy} onClick={inspect}>{busy ? "확인 중…" : "합치기 내용 확인"}</button>
      </> : <>
        <div className="merge-direction"><span><small>사용 종료</small><b>{preview.source.chatNickname}</b></span><ArrowRight size={20} /><span><small>계속 사용</small><b>{preview.target.chatNickname}</b></span></div>
        <ul className="merge-details">
          <li>받은 칭찬 {preview.source.receivedCount}개, 보낸 칭찬 {preview.source.sentCount}개를 옮겨요.</li>
          <li>공감 {preview.likes}개를 옮기고, 겹치는 {preview.duplicateLikes}개는 한 번만 계산해요.</li>
          <li>신고 {preview.reports}건도 함께 옮겨요.</li>
          <li>두 계정 사이의 칭찬 {preview.betweenCompliments}개는 본인 간 기록이 되므로 숨겨요.</li>
          <li><b>{preview.target.chatNickname}</b> 계정의 비밀번호를 계속 사용해요. 두 계정 모두 로그아웃돼요.</li>
          <li>옛 닉네임으로는 로그인하거나 다시 가입할 수 없어요.</li>
        </ul>
        <label className="merge-confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} />같은 사람의 계정임을 확인했습니다.</label>
        <div className="merge-actions"><button className="secondary-button" disabled={busy} onClick={() => { setPreview(null); setConfirmed(false); setError(""); }}>다시 선택</button><button className="primary-button" disabled={!confirmed || busy} onClick={merge}><Users size={16} />{busy ? "합치는 중…" : "계정 합치기"}</button></div>
      </>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </DialogContent>
  </Dialog>;
}
