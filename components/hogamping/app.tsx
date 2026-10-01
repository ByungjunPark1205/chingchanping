"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "./link";
import {
  ArrowDown,
  ArrowRight,
  Bell,
  ChevronRight,
  Compass,
  ThumbsUp,
  Home,
  List,
  LockKeyhole,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { PingMark, PingIcon, Avatar } from "./visuals";
import { PageHeading, Loading, Empty } from "./common";
import { PingCard, PingCollection } from "./cards";
import { PingMap } from "./ping-map";
import { AuthDialog, ComposeDialog, ReportDialog } from "./dialogs";
import { SettingsView } from "./settings";
import { AdminView } from "./admin";
import { api, ApiError } from "@/lib/client";
import { examplePings } from "@/lib/examples";
import { type Member, type Viewer, type Ping, type Page } from "@/lib/types";

const nav = [
  { page: "home", href: "/", label: "홈", Icon: Home },
  { page: "send", href: "/send", label: "칭찬핑 보내기", Icon: PingIcon },
  { page: "received", href: "/received", label: "받은 칭찬핑", Icon: ThumbsUp },
  { page: "profile", href: "/profile", label: "내 프로필", Icon: UserRound },
  { page: "settings", href: "/settings", label: "설정", Icon: Settings },
] as const;

export function Chingchanping({
  page,
  userId,
}: {
  page: Page;
  userId?: string;
}) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [pings, setPings] = useState<Ping[]>([]);
  const [weeklyPings, setWeeklyPings] = useState<Ping[]>([]);
  const [homeQuery, setHomeQuery] = useState("");
  const refreshSequence = useRef(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState({ pings: 0, members: 0, today: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState<"login" | "register" | null>(null);
  const [recipient, setRecipient] = useState<Member | null>(null);
  const [report, setReport] = useState<Ping | null>(null);
  const [guide, setGuide] = useState(false);
  const [motion, setMotion] = useState(true);
  const [profile, setProfile] = useState<Member | null>(null);
  const [privatePings, setPrivatePings] = useState<Ping[]>([]);
  const [privateError, setPrivateError] = useState("");
  const [privateLoading, setPrivateLoading] = useState(false);

  const clearAccount = useCallback(() => {
    setViewer(null);
    setPings([]);
    setWeeklyPings([]);
    setMembers([]);
    setStats({ pings: 0, members: 0, today: 0 });
    setProfile(null);
    setPrivatePings([]);
    setPrivateError("");
    setPrivateLoading(false);
    setLoading(false);
    setRecipient(null);
    setReport(null);
    setGuide(false);
  }, []);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const data = await api<{
        viewer: Viewer | null;
        pings: Ping[];
        weeklyPings: Ping[];
        members: Member[];
        stats: typeof stats;
      }>(`/home${homeQuery}`);
      if (sequence !== refreshSequence.current) return;
      setViewer(data.viewer);
      setPings(data.pings);
      setWeeklyPings(data.weeklyPings);
      setMembers(data.members);
      setStats(data.stats);
      setError("");
    } catch (e) {
      if (sequence !== refreshSequence.current) return;
      if (e instanceof ApiError && e.status === 401) {
        clearAccount();
        setError("");
      } else setError((e as Error).message);
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [homeQuery, clearAccount]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch initial data and hydrate the browser-only preference after SSR.
    void refresh();
    const pref = localStorage.getItem("hogamping-motion");
    if (pref === "off") setMotion(false);
  }, [refresh]);
  useEffect(() => {
    document.documentElement.classList.toggle("motion-off", !motion);
    return () => document.documentElement.classList.remove("motion-off");
  }, [motion]);
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handle);
    window.addEventListener("focus", handle);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      window.removeEventListener("focus", handle);
    };
  }, [refresh]);
  useEffect(() => {
    let cancelled = false;
    const id = userId ?? viewer?.id;
    if (!viewer?.id || (page !== "profile" && page !== "received") || !id) return;
    if (!userId && viewer?.approvalStatus === "pending") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset the request indicator when the profile or authenticated account changes.
    setPrivateLoading(true);
    setProfile(null);
    setPrivatePings([]);
    setPrivateError("");
    void api<{ member: Member; pings: Ping[] }>(
      page === "received" ? "/received" : `/users/${encodeURIComponent(id)}`,
    )
      .then(async (data) => {
        if (cancelled) return;
        setProfile(data.member);
        setPrivatePings(data.pings);
        if (page === "received" && data.pings.length) {
          await api("/received/read", {
            lastSeenAt: Math.max(...data.pings.map((p) => p.createdAt)),
          });
          if (!cancelled) setViewer((v) => (v ? { ...v, unread: 0 } : null));
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          ++refreshSequence.current;
          clearAccount();
        } else setPrivateError(e.message);
      })
      .finally(() => {
        if (!cancelled) setPrivateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, userId, viewer?.id, viewer?.approvalStatus, pings, clearAccount]);
  function compose(member: Member) {
    if (viewer?.approvalStatus === "pending") { toast("가입 승인 후 칭찬을 보낼 수 있어요."); return; }
    if (!viewer) {
      setRecipient(member);
      setAuth("login");
    } else setRecipient(member);
  }
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool || !viewer) return;
    const lifecycle = new AbortController();
    const register = (tool: Tool) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    };
    register({
      name: "search_community_members",
      description:
        "Search registered community members by chat or in-game nickname. Requires login and returns member profiles without author identities.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", maxLength: 40 } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        if (
          !input ||
          typeof input !== "object" ||
          typeof (input as { query: unknown }).query !== "string"
        )
          throw new Error("query must be a string");
        const query = (input as { query: string }).query
          .trim()
          .toLocaleLowerCase();
        if (query.length > 40) throw new Error("query is too long");
        return members.filter((m) =>
          `${m.chatNickname} ${m.lolNickname}`
            .toLocaleLowerCase()
            .includes(query),
        );
      },
    });
    register({
      name: "start_compliment",
      description:
        "Open the visible compliment writing dialog for a registered recipient. Does not send a compliment. Requires login.",
      inputSchema: {
        type: "object",
        properties: { recipientId: { type: "string" } },
        required: ["recipientId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (!viewer) throw new Error("Login is required");
        if (viewer.approvalStatus !== "approved") throw new Error("Membership approval is required");
        const id = (input as { recipientId?: unknown })?.recipientId;
        if (typeof id !== "string")
          throw new Error("recipientId must be a string");
        const person = members.find((m) => m.id === id);
        if (!person || person.id === viewer.id)
          throw new Error("Choose another active member");
        setRecipient(person);
        return { status: "composer_opened", recipientId: person.id };
      },
    });
    return () => lifecycle.abort();
  }, [members, viewer]);
  async function logout() {
    try {
      await api("/auth/logout", {});
      ++refreshSequence.current;
      clearAccount();
      await refresh();
      toast("로그아웃했어요.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function like(ping: Ping) {
    if (!viewer) { setAuth("login"); return; }
    if (viewer.approvalStatus === "pending") { toast("가입 승인 후 공감할 수 있어요."); return; }
    try {
      await api("/compliments/like", { complimentId: ping.id, liked: !ping.liked });
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        ++refreshSequence.current;
        clearAccount();
      }
      toast.error((e as Error).message);
    }
  }
  const needsLogin = !viewer;
  return (
    <SidebarProvider
      className={`app-shell ${!motion ? "motion-off" : ""}`}
      style={{ "--sidebar-width": "232px" } as React.CSSProperties}
    >
      <Sidebar className="desktop-sidebar" collapsible="none">
        <SidebarHeader className="brand-header">
          <Link href="/" className="brand">
            <PingMark />
            <span>
              칭찬핑<small>CHINGCHANPING</small>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <nav className="side-nav" aria-label="주 메뉴">
            {nav.map(({ page: p, href, label, Icon }) => (
              <Link
                key={p}
                href={href}
                className={page === p ? "active" : ""}
                aria-current={page === p ? "page" : undefined}
              >
                <Icon size={20} />
                <span>{label}</span>
                {p === "received" && !!viewer?.unread && (
                  <span className="notification-dot" aria-label="새 칭찬핑" />
                )}
              </Link>
            ))}
          </nav>
        </SidebarContent>
        <SidebarFooter className="side-footer">
          {viewer?.role === "admin" && (
            <Link className="guide-button" href="/admin">
              <ShieldCheck size={17} />
              관리자 페이지
              <ChevronRight size={14} />
            </Link>
          )}
          {viewer ? (
            <div className="sidebar-user">
              <Link href="/profile">
                <Avatar name={viewer.chatNickname} index={viewer.avatar} />
                <span>
                  {viewer.chatNickname}
                  <small>{viewer.approvalStatus === "pending" ? "승인 대기" : "로그인 중"}</small>
                </span>
              </Link>
              <button aria-label="로그아웃" onClick={logout}>
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <button type="button" className="sidebar-login" onClick={() => setAuth("register")}>
              <UserRound size={18} aria-hidden="true" />
              <span>가입하기</span>
            </button>
          )}
        </SidebarFooter>
      </Sidebar>
      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-context">
            <PingIcon size={18} /> 게임 커뮤니티를 위한 익명 칭찬 서비스
          </div>
          <Link className="mobile-brand" href="/">
            <PingMark />
            칭찬핑
          </Link>
          <div className="topbar-actions">
            <Link
              href="/received"
              className="icon-button"
              aria-label="받은 칭찬핑 확인"
              onClick={(event) => {
                if (!viewer) { event.preventDefault(); setAuth("login"); }
              }}
            >
              <Bell size={19} />
              {!!viewer?.unread && <i />}
            </Link>
            {viewer ? (
              <Link className="top-profile" href="/profile">
                <Avatar name={viewer.chatNickname} index={viewer.avatar} />
                <span>{viewer.chatNickname}</span>
              </Link>
            ) : (
              <button className="login-link" onClick={() => setAuth("login")}>
                로그인 <ArrowRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main id="main-content" className={`main-content page-${page}`}>
          {viewer?.approvalStatus === "pending" && <div className="approval-banner" role="status"><div><b>가입 승인 대기 중</b><p>운영자가 승인하면 칭찬을 보내고 공감할 수 있어요.</p></div><button className="secondary-button" onClick={refresh}>승인 상태 확인</button></div>}
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={refresh}>다시 연결</button>
            </div>
          )}
          {needsLogin && loading && <Loading />}
          {page === "home" && viewer && (
            <HomeBoard
              pings={pings}
              weeklyPings={weeklyPings}
              stats={stats}
              loading={loading}
              error={error}
              onLike={like}
              onDateRange={(start, end) => {
                const query = start && end ? `?${new URLSearchParams({ start, end })}` : "";
                if (query !== homeQuery) {
                  ++refreshSequence.current;
                  setLoading(true);
                  setHomeQuery(query);
                }
              }}
              onGuide={() => setGuide(true)}
            />
          )}
          {page === "send" && viewer && (
            <MemberDirectory
              members={members}
              viewer={viewer}
              loading={loading}
              compose={compose}
            />
          )}
          {needsLogin && !loading && (
            <div className="login-gate">
              <PingMark />
              <h1>
                로그인 후 이용해주세요
              </h1>
              <p>칭찬과 회원 목록은 로그인한 회원만 볼 수 있습니다.</p>
              <button
                className="primary-button"
                onClick={() => setAuth("login")}
              >
                로그인하기 <ArrowRight size={17} />
              </button>
              <button
                className="text-button"
                onClick={() => setAuth("register")}
              >
                가입하기
              </button>
            </div>
          )}
          {page === "received" && viewer && viewer.approvalStatus === "approved" && (
            <>
              <PageHeading
                title="내가 받은 칭찬핑"
                description="나에게 남겨진 칭찬을 확인해보세요."
              />
              <div className="inbox-banner">
                <PingMark />
                <p>
                  <b>{viewer.chatNickname}님이 받은 칭찬</b>
                  <span>
                    지금까지 {viewer.count}개의 칭찬을 받았어요.
                  </span>
                </p>
                <strong>
                  {viewer.count}
                  <ThumbsUp size={21} />
                </strong>
              </div>
              <PingCollection
                pings={privatePings}
                loading={privateLoading}
                error={privateError}
                onReport={setReport}
                onLike={like}
              />
            </>
          )}
          {page === "profile" && !needsLogin && (userId || viewer?.approvalStatus === "approved") && (
            <>
              {privateLoading ? (
                <Loading />
              ) : privateError ? (
                <Empty title="프로필을 불러오지 못했어요" text={privateError} />
              ) : profile ? (
                <>
                  <div className="profile-hero">
                    <Avatar
                      name={profile.chatNickname}
                      index={profile.avatar}
                      large
                    />
                    <div>
                      <div className="eyebrow">
                        회원 프로필
                      </div>
                      <h1>{profile.chatNickname}</h1>
                      {profile.lolNickname && <p>
                        게임 닉네임 <span>{profile.lolNickname}</span>
                      </p>}
                    </div>
                    <div className="profile-count">
                      <ThumbsUp size={20} />
                      <b>{profile.count}</b>
                      <span>받은 칭찬핑</span>
                    </div>
                  </div>
                  {viewer?.id !== profile.id ? (
                    <button
                      className="primary-button profile-send"
                      onClick={() => compose(profile)}
                    >
                      <PingIcon size={18} />이 사람에게 칭찬핑 보내기
                    </button>
                  ) : (
                    <Link
                      className="secondary-button profile-send"
                      href="/settings"
                    >
                      내 프로필 수정하기 <Settings size={16} />
                    </Link>
                  )}
                  <h2 className="section-title">
                    {profile.chatNickname}님이 받은 칭찬
                  </h2>
                  <PingCollection pings={privatePings} onLike={like} />
                </>
              ) : null}
            </>
          )}
          {page === "settings" && viewer && (
            <SettingsView
              viewer={viewer}
              refresh={refresh}
              motion={motion}
              setMotion={(value) => {
                setMotion(value);
                localStorage.setItem("hogamping-motion", value ? "on" : "off");
              }}
              logout={logout}
            />
          )}
          {page === "admin" && viewer && (
            <AdminView
              viewer={viewer}
              loading={loading}
              onLogin={() => setAuth("login")}
              refresh={refresh}
            />
          )}
          {page === "notfound" && viewer && (
            <Empty
              title="페이지를 찾을 수 없어요"
              text="주소를 확인하거나 홈으로 이동해주세요."
            >
              <Link className="primary-button" href="/">
                홈으로 돌아가기
              </Link>
            </Empty>
          )}
        </main>
        <footer className="main-footer">
          <span>게임 커뮤니티를 위한 익명 칭찬 서비스</span>
          <span>CHINGCHANPING</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="모바일 주 메뉴">
        {nav.map(({ page: p, href, label, Icon }) => (
          <Link
            key={p}
            href={href}
            className={page === p ? "active" : ""}
            aria-current={page === p ? "page" : undefined}
          >
            <Icon size={21} />
            <span>
              {p === "send"
                ? "핑 보내기"
                : p === "received"
                  ? "받은 핑"
                  : label}
            </span>
            {p === "received" && !!viewer?.unread && <i />}
          </Link>
        ))}
      </nav>
      <AuthDialog
        key={auth ?? "closed"}
        mode={auth}
        setMode={setAuth}
        onSuccess={async () => {
          await refresh();
          setAuth(null);
        }}
      />
      {viewer?.approvalStatus === "approved" && recipient && (
        <ComposeDialog
          key={recipient.id}
          member={recipient}
          isAdmin={viewer.role === "admin"}
          onClose={() => setRecipient(null)}
          onSuccess={refresh}
        />
      )}
      {viewer && <ReportDialog key={report?.id ?? "closed"} ping={report} onClose={() => setReport(null)} />}
      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent className="hogam-dialog">
          <DialogTitle>칭찬핑 이용 안내</DialogTitle>
          <DialogDescription>
            칭찬할 사람을 선택하고, 어떤 점이 좋았는지 적어주세요.
          </DialogDescription>
          <div className="guide-steps">
            <p>
              <b>01</b>
              <span>톡방 닉네임으로 가입 신청 후 승인받기</span>
            </p>
            <p>
              <b>02</b>
              <span>칭찬할 사람 검색하기</span>
            </p>
            <p>
              <b>03</b>
              <span>칭찬 내용 작성하고 보내기</span>
            </p>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={20} />
            <p>
              작성자는 다른 회원에게 공개되지 않아요. 수신자가 메시지를 신고하면
              관리자에게만 작성자와 신고 내용이 표시돼요.
            </p>
          </div>
          <p className="muted">
            {viewer?.role === "admin"
              ? "관리자 계정은 전송 횟수와 대기시간 제한이 없어요."
              : "한 사람에게는 1분에 한 번, 하루 3번까지, 전체 하루 10번까지 보낼 수 있어요."}
          </p>
          <button
            className="primary-button full"
            onClick={() => setGuide(false)}
          >
            확인
          </button>
        </DialogContent>
      </Dialog>
      <Toaster theme="dark" position="top-center" richColors />
    </SidebarProvider>
  );
}

function HomeBoard({
  pings,
  weeklyPings,
  stats,
  loading,
  error,
  onLike,
  onDateRange,
  onGuide,
}: {
  pings: Ping[];
  weeklyPings: Ping[];
  stats: { pings: number; members: number; today: number };
  loading: boolean;
  error: string;
  onLike: (ping: Ping) => Promise<void>;
  onDateRange: (start?: string, end?: string) => void;
  onGuide: () => void;
}) {
  const [mode, setMode] = useState("space");
  const [filter, setFilter] = useState("all");
  const [today] = useState(() => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10));
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [appliedRange, setAppliedRange] = useState("");
  const [dateError, setDateError] = useState("");
  const isExample = !loading && !error && !appliedRange && stats.pings === 0;
  const rankedIds = new Set(weeklyPings.map((p) => p.id));
  const filtered = isExample ? examplePings : [
    ...weeklyPings,
    ...pings.filter((p) => !rankedIds.has(p.id)),
  ];
  return (
    <>
      <figure className="community-quote">
        <blockquote>“남을 찬양하면 자신에게 돌아온다. 사람이란 자신을 칭찬하는 사람을 칭찬하고 싶어한다.” <cite>— 괴테 (독일 시인)</cite></blockquote>
      </figure>
      <PageHeading
        title="칭찬핑"
        description="함께한 사람에게 칭찬을 남겨보세요."
      >
        <Link className="primary-button" href="/send">
          <PingIcon size={19} />
          칭찬핑 보내기
          <ArrowRight size={17} />
        </Link>
      </PageHeading>
      <section className={`board-section ${mode === "list" ? "list-view-section" : "map-view-section"}`} aria-label="칭찬핑 보드">
        <div className="board-toolbar">
          <div className="board-title">
            <span className="live-dot" />
            <h2>커뮤니티 칭찬</h2>
            <span className="board-total">{stats.pings}</span>
          </div>
          <div className="board-controls">
            <Tabs value={filter} onValueChange={(value) => {
              setFilter(value);
              setDateError("");
              if (value === "all") {
                setAppliedRange("");
                onDateRange();
              }
            }}>
              <TabsList className="filter-tabs">
                <TabsTrigger value="all">전체</TabsTrigger>
                <TabsTrigger value="custom">지정날짜</TabsTrigger>
              </TabsList>
            </Tabs>
            <div
              className="view-toggle"
              role="group"
              aria-label="보드 보기 방식"
            >
              <button
                aria-label="지도로 보기"
                aria-pressed={mode === "space"}
                className={mode === "space" ? "selected" : ""}
                onClick={() => setMode("space")}
              >
                <Compass size={18} />
              </button>
              <button
                aria-label="목록으로 보기"
                aria-pressed={mode === "list"}
                className={mode === "list" ? "selected" : ""}
                onClick={() => setMode("list")}
              >
                <List size={19} />
              </button>
            </div>
          </div>
        </div>
        {filter === "custom" && (
          <form className="date-range-filter" onSubmit={(event) => {
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
            setAppliedRange(`${from} ~ ${until}`);
            onDateRange(from, until);
          }}>
            <label>시작 날짜<input type="date" name="start" defaultValue={start} required /></label>
            <span className="date-range-dash" aria-hidden="true">—</span>
            <label>마지막 날짜<input type="date" name="end" defaultValue={end} required /></label>
            <button type="submit" className="secondary-button">적용하기</button>
            <p className="date-range-hint">{appliedRange ? `${appliedRange}에 등록된 칭찬` : "기간을 선택하고 적용해주세요. 현재는 전체 기간이에요."} · 한국 시간 기준</p>
            {dateError && <p role="alert" className="form-error">{dateError}</p>}
          </form>
        )}
        {!loading && !error && !isExample && filtered.length > 0 && (
          <p className="feed-description">
            {weeklyPings.length > 0
              ? "이번 주 공감 상위 3개와 최근 칭찬입니다. 순위는 매주 월요일 0시(한국 시간)에 초기화돼요."
              : "최근 등록된 칭찬부터 표시합니다."}
          </p>
        )}
        {isExample && (
          <div className="example-label">
            <Sparkles size={13} />
            <span>아직 등록된 칭찬이 없어 예시를 표시하고 있어요.</span>
          </div>
        )}
        <div
          className={`ping-board ${mode === "list" ? "list-board" : "map-board"}`}
        >
          {loading ? (
            <Loading />
          ) : error ? (
            <Empty title="칭찬을 불러오지 못했어요" text="위의 다시 연결 버튼을 눌러주세요." />
          ) : filtered.length === 0 ? (
            <Empty
              title={
                appliedRange
                  ? "선택한 기간에 등록된 칭찬이 없어요."
                  : undefined
              }
              text="다른 기간을 선택하거나 새로운 칭찬을 남겨보세요."
            >
              <Link className="secondary-button" href="/send">
                칭찬 보내기 <ArrowRight size={16} />
              </Link>
            </Empty>
          ) : mode === "space" ? (
            <PingMap key={appliedRange} pings={filtered} weeklyIds={isExample ? [] : weeklyPings.map((ping) => ping.id)} example={isExample} onLike={onLike} />
          ) : (
            <div className="board-cards">
              {filtered.map((ping, i) => (
                  <PingCard
                    key={ping.id}
                    ping={ping}
                    example={isExample}
                    className={`board-card card-position-${i}`}
                    index={i}
                    onLike={onLike}
                    rank={!isExample && i < weeklyPings.length ? i + 1 : undefined}
                  />
                ))}
            </div>
          )}
        </div>
        <div className="board-legend">
          <span>
            <span className="live-dot" />
            핑 하나에 칭찬 하나가 표시돼요.
          </span>
          <span>
            <LockKeyhole size={13} />
            작성자 비공개
          </span>
        </div>
      </section>
      <div className="home-bottom">
        <div className="community-stats">
          <div className="stats-icon">
            <Users size={23} />
          </div>
          <div>
            <b>커뮤니티 현황</b>
            <p>
              회원 <strong>{stats.members}</strong>명 <span>·</span> 칭찬 <strong>{stats.pings}</strong>개
            </p>
          </div>
          <div className="today-stat">
            <span>오늘 등록</span>
            <b>{stats.today}개</b>
          </div>
        </div>
        <button className="home-guide" onClick={onGuide}>
          <div>
            <span>이용 안내</span>
            <b>칭찬 보내는 방법</b>
          </div>
          <span className="round-arrow">
            <ArrowRight size={19} />
          </span>
        </button>
      </div>
    </>
  );
}

function MemberDirectory({
  members,
  viewer,
  loading,
  compose,
}: {
  members: Member[];
  viewer: Viewer | null;
  loading: boolean;
  compose: (m: Member) => void;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(24);
  const filtered = members.filter(
    (m) =>
      m.id !== viewer?.id &&
      `${m.chatNickname} ${m.lolNickname}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase().trim()),
  );
  return (
    <>
      <PageHeading
        title="칭찬할 사람 찾기"
        description="칭찬을 보낼 회원을 선택해주세요."
      />
      <div className="search-box">
        <Search size={21} />
        <input
          aria-label="톡방 닉네임 또는 게임 닉네임 검색"
          placeholder="톡방 닉네임 또는 게임 닉네임 검색"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(24);
          }}
        />
        {query && (
          <button aria-label="검색 초기화" onClick={() => setQuery("")}>
            <X size={17} />
          </button>
        )}
      </div>
      <div className="directory-info">
        <span>
          회원 <b>{filtered.length}</b>명
        </span>
        <span>닉네임 가나다순</span>
      </div>
      {loading ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty
          title={
            query
              ? "검색 결과가 없어요"
              : "아직 칭찬을 보낼 회원이 없어요"
          }
          text={
            query
              ? "닉네임을 조금 다르게 검색해보세요."
              : "다른 회원이 가입하면 여기에 표시돼요."
          }
        />
      ) : (
        <>
          <div className="member-grid">
            {filtered.slice(0, limit).map((m) => (
              <article className="member-card" key={m.id}>
                <Link href={`/user/${m.id}`} className="member-identity">
                  <Avatar name={m.chatNickname} index={m.avatar} large />
                  <h2>{m.chatNickname}</h2>
                  <p>{m.lolNickname || "톡방 멤버"}</p>
                </Link>
                <div className="member-count">
                  <ThumbsUp size={14} />
                  받은 칭찬핑 <b>{m.count}</b>
                </div>
                <button
                  className="secondary-button full"
                  onClick={() => compose(m)}
                >
                  <PingIcon size={17} />
                  칭찬핑 보내기
                </button>
              </article>
            ))}
          </div>
          {filtered.length > limit && (
            <button
              className="load-more"
              onClick={() => setLimit((l) => l + 24)}
            >
              멤버 더 보기 <ArrowDown size={16} />
            </button>
          )}
        </>
      )}
    </>
  );
}
