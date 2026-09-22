"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { time } from "@/lib/format";
import type { Viewer } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Empty, Loading, PageHeading } from "./common";

type AdminPing = {
  id: string;
  message: string;
  sender: string;
  receiver: string;
  createdAt: number;
  isHidden: number;
  reportCount: number;
};
type AdminUser = {
  id: string;
  chatNickname: string;
  lolNickname: string;
  createdAt: number;
  isActive: number;
  role: string;
};
type AdminReport = {
  id: string;
  complimentId: string;
  message: string;
  reason: string;
  reporter: string;
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
    users: AdminUser[];
    pings: AdminPing[];
    reports: AdminReport[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    kind: string;
    id: string;
    label: string;
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
    if (viewer?.role === "admin") void load();
  }, [viewer?.role, load]);
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
          eyebrow="COMMUNITY CARE"
          title="운영자 공간"
          description="커뮤니티의 좋은 분위기를 함께 지켜요."
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
        eyebrow="COMMUNITY CARE"
        title="운영자 공간"
        description="좋은 마음이 안전하게 오갈 수 있도록."
      />
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={load}>다시 불러오기</button>
        </div>
      )}
      {!data ? (
        <Loading />
      ) : (
        <Tabs defaultValue="reports" className="admin-tabs">
          <TabsList>
            <TabsTrigger value="reports">
              신고 {data.reports.filter((r) => r.status === "pending").length}
            </TabsTrigger>
            <TabsTrigger value="pings">전체 칭찬</TabsTrigger>
            <TabsTrigger value="users">등록 사용자</TabsTrigger>
          </TabsList>
          <TabsContent value="reports">
            {data.reports.length === 0 ? (
              <Empty
                title="접수된 신고가 없어요"
                text="서로에게 다정한 아지트를 만들어주셔서 감사해요."
              />
            ) : (
              data.reports.map((r) => (
                <article className="admin-record" key={r.id}>
                  <div className="admin-record-head">
                    <b>{r.status === "pending" ? "확인 필요" : "처리 완료"}</b>
                    <span>{time(r.createdAt)}</span>
                  </div>
                  <p>{r.message}</p>
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
                      {p.sender} <ArrowRight size={14} /> {p.receiver}
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
            <div className="admin-users">
              {data.users.map((u) => (
                <article className="admin-record" key={u.id}>
                  <div className="admin-record-head">
                    <b>{u.chatNickname}</b>
                    <span>
                      {u.role === "admin"
                        ? "운영자"
                        : u.isActive
                          ? "활성"
                          : "비활성"}
                    </span>
                  </div>
                  <p>{u.lolNickname}</p>
                  <small>
                    등록일 {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                  </small>
                  {u.role !== "admin" && (
                    <button
                      disabled={busy}
                      className="secondary-button"
                      onClick={() =>
                        setConfirm({
                          kind: u.isActive ? "deactivate" : "activate",
                          id: u.id,
                          label: `${u.chatNickname}님을 ${u.isActive ? "비활성화" : "활성화"}할까요?`,
                        })
                      }
                    >
                      {u.isActive ? "사용자 비활성화" : "사용자 활성화"}
                    </button>
                  )}
                </article>
              ))}
            </div>
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
              메시지를 숨기면 공개 보드와 프로필에서 사라집니다. 비활성화된
              사용자는 로그인하거나 칭찬을 보낼 수 없습니다. 나중에 되돌릴 수
              있어요.
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
