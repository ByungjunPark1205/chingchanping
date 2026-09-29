"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, RefreshCw, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { time } from "@/lib/format";
import type { Viewer } from "@/lib/types";
import type { ManagedMember, MemberAction } from "@/lib/admin-types";
import { MemberManagement } from "./member-management";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Empty, Loading, PageHeading } from "./common";

type AdminPing = {
  id: string;
  message: string;
  receiver: string;
  createdAt: number;
  isHidden: number;
  reportCount: number;
};
type AdminReport = {
  id: string;
  complimentId: string;
  message: string;
  reason: string;
  reporter: string;
  sender: string;
  receiver: string;
  messageCreatedAt: number;
  isHidden: number;
  status: string;
  createdAt: number;
};
export function AdminView({
  viewer,
  loading,
  onLogin,
  refresh,
}: {
  viewer: Viewer | null;
  loading: boolean;
  onLogin: () => void;
  refresh: () => Promise<void>;
}) {
  const [data, setData] = useState<{
    users: ManagedMember[];
    pings: AdminPing[];
    reports: AdminReport[];
    actions: MemberAction[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    kind: string;
    id: string;
    label: string;
    description: string;
  } | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await api("/admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (viewer?.role !== "admin") return;
    let cancelled = false;
    void api<NonNullable<typeof data>>("/admin").then((next) => { if (!cancelled) { setData(next); setError(""); } }).catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [viewer?.role]);
  if (loading) return <Loading />;
  if (!viewer)
    return (
      <Empty title="운영자 공간입니다" text="운영자 계정으로 로그인해주세요.">
        <button className="primary-button" onClick={onLogin}>
          로그인하기
        </button>
      </Empty>
    );
  if (viewer.role !== "admin")
    return (
      <>
        <PageHeading
          title="관리자 페이지"
          description="신고 내역과 칭찬, 회원을 관리해요."
        />
        <section className="settings-panel setup-panel">
          <ShieldCheck size={30} />
          <h2>최초 운영자 등록</h2>
          <p className="muted">
            사이트 소유자에게 전달된 초기 설정 키가 필요합니다. 운영자가 등록된
            후에는 사용할 수 없습니다.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api("/admin/setup", { token: f.get("token") });
                await refresh();
                toast.success("운영자로 등록했어요.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              초기 설정 키
              <input name="token" type="password" required autoComplete="off" />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" disabled={busy}>
              운영자 등록
            </button>
          </form>
        </section>
      </>
    );
  async function act(kind: string, id: string) {
    setBusy(true);
    try {
      await api("/admin/action", { kind, id });
      await load();
      await refresh();
      setConfirm(null);
      toast.success("처리했어요.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="관리자 페이지"
        description="가입 승인, 회원 관리, 신고 처리를 할 수 있어요."
      ><button className="secondary-button" disabled={busy} onClick={load}><RefreshCw size={16} />새로고침</button></PageHeading>
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={load}>다시 불러오기</button>
        </div>
      )}
      {!data ? (
        <Loading />
      ) : (
        <Tabs defaultValue="users" className="admin-tabs">
          <TabsList>
            <TabsTrigger value="users">회원 관리 {data.users.filter((u) => u.isActive && !u.mergedInto && u.approvalStatus === "pending").length > 0 && `· 승인 대기 ${data.users.filter((u) => u.isActive && !u.mergedInto && u.approvalStatus === "pending").length}`}</TabsTrigger>
            <TabsTrigger value="reports">
              신고 {data.reports.filter((r) => r.status === "pending").length}
            </TabsTrigger>
            <TabsTrigger value="pings">전체 칭찬</TabsTrigger>
          </TabsList>
          <TabsContent value="reports">
            <p className="report-privacy"><LockKeyhole size={16} />수신자가 신고한 칭찬의 작성자만 관리자에게 표시됩니다. 신고자와 다른 회원에게는 공개되지 않아요.</p>
            {data.reports.length === 0 ? (
              <Empty
                title="접수된 신고가 없어요"
                text="신고가 접수되면 여기에 표시돼요."
              />
            ) : (
              data.reports.map((r) => (
                <article className="admin-record" key={r.id}>
                  <div className="admin-record-head">
                    <b>{r.status === "pending" ? "확인 필요" : "처리 완료"}</b>
                    <span>신고 {time(r.createdAt)}</span>
                  </div>
                  <div className="report-identities"><span><small>작성자 · 관리자만 표시</small><b>{r.sender}</b></span><ArrowRight size={16} /><span><small>수신자</small><b>{r.receiver}</b></span></div>
                  <p>{r.message}</p>
                  <small>작성 {new Date(r.messageCreatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {r.isHidden ? "숨김 처리됨" : "공개 중"}</small>
                  <div className="report-reason">
                    <b>신고 사유</b> {r.reason}
                    <small>신고자: {r.reporter}</small>
                  </div>
                  {r.status === "pending" && (
                    <div className="admin-actions">
                      <button
                        disabled={busy}
                        className="secondary-button"
                        onClick={() =>
                          setConfirm({
                            kind: "hide",
                            id: r.complimentId,
                            label: "이 메시지를 숨길까요?",
                            description: "공개 보드와 프로필에서 숨깁니다. 나중에 다시 공개할 수 있어요.",
                          })
                        }
                      >
                        메시지 숨기기
                      </button>
                      <button
                        disabled={busy}
                        className="text-button"
                        onClick={() => act("resolve", r.id)}
                      >
                        검토 완료
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </TabsContent>
          <TabsContent value="pings">
            {data.pings.length === 0 ? (
              <Empty />
            ) : (
              data.pings.map((p) => (
                <article className="admin-record" key={p.id}>
                  <div className="admin-record-head">
                    <b>
                      익명 <ArrowRight size={14} /> {p.receiver}
                    </b>
                    <span>{time(p.createdAt)}</span>
                  </div>
                  <p>{p.message}</p>
                  <div className="admin-actions">
                    <span>
                      {p.isHidden ? "숨김 처리됨" : `신고 ${p.reportCount}건`}
                    </span>
                    <button
                      disabled={busy}
                      className="secondary-button"
                      onClick={() =>
                        setConfirm({
                          kind: p.isHidden ? "restore" : "hide",
                          id: p.id,
                          label: p.isHidden
                            ? "이 메시지를 다시 공개할까요?"
                            : "이 메시지를 숨길까요?",
                          description: p.isHidden ? "공개 보드와 프로필에 다시 표시합니다." : "공개 보드와 프로필에서 숨깁니다. 나중에 다시 공개할 수 있어요.",
                        })
                      }
                    >
                      {p.isHidden ? "복원" : "메시지 숨기기"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </TabsContent>
          <TabsContent value="users">
            <MemberManagement users={data.users} actions={data.actions} busy={busy}
              onMerged={async () => { await load(); await refresh(); }}
              onAction={(kind, u) => setConfirm({ kind, id: u.id,
                label: `${u.chatNickname}님의 ${kind === "approve" ? "가입을 승인할까요?" : kind === "activate" ? "이용을 복구할까요?" : "계정을 내보낼까요?"}`,
                description: kind === "approve" ? "회원 목록에 표시되고 칭찬과 공감 기능을 이용할 수 있어요."
                  : kind === "activate" ? (u.approvalStatus === "pending" ? "가입 승인 대기 상태로 복구합니다. 활동을 허용하려면 이후 가입 승인도 필요해요." : "다시 로그인하고 활동할 수 있어요. 받은 칭찬도 다시 표시됩니다.")
                    : "즉시 로그아웃되고 로그인·활동이 차단됩니다. 회원 목록과 받은 칭찬이 숨겨지며, 같은 닉네임으로 재가입할 수 없어요. 기록은 보관되고 나중에 이용을 복구할 수 있어요.",
              })} />
          </TabsContent>
        </Tabs>
      )}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <AlertDialogContent className="hogam-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (confirm) void act(confirm.kind, confirm.id);
              }}
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
