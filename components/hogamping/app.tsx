"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "./link";
import {
  ArrowDown,
  ArrowRight,
  Bell,
  ChevronRight,
  CircleHelp,
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
import { AuthDialog, ComposeDialog, ReportDialog } from "./dialogs";
import { SettingsView } from "./settings";
import { AdminView } from "./admin";
import { api } from "@/lib/client";
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
      if (sequence === refreshSequence.current) setError((e as Error).message);
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [homeQuery]);
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
    return () => document.removeEventListener("visibilitychange", handle);
  }, [refresh]);
  useEffect(() => {
    let cancelled = false;
    const id = userId ?? viewer?.id;
    if ((page !== "profile" && page !== "received") || !id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset the request indicator when the profile or authenticated account changes.
    setPrivateLoading(true);
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
        if (!cancelled) setPrivateError(e.message);
      })
      .finally(() => {
        if (!cancelled) setPrivateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, userId, viewer?.id, pings]);
  function compose(member: Member) {
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
    if (!context?.registerTool) return;
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
        "Search registered community members by chat or in-game nickname. Returns public profiles only.",
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
      setViewer(null);
      setPrivatePings([]);
      await refresh();
      toast("다음 게임에서 또 만나요.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function like(ping: Ping) {
    if (!viewer) { setAuth("login"); return; }
    try {
      await api("/compliments/like", { complimentId: ping.id, liked: !ping.liked });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const needsLogin =
    !viewer &&
    (page === "received" ||
      page === "settings" ||
      (page === "profile" && !userId));
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
          <div className="nav-caption">우리의 작은 아지트</div>
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
          <div className="sidebar-note">
            <PingMark />
            <p>좋은 행동을 발견하면, 칭찬으로 알려주세요.</p>
            <span>
              함께해서 고마웠던 순간을
              <br />
              구체적인 칭찬으로 남겨보세요.
            </span>
          </div>
        </SidebarContent>
        <SidebarFooter className="side-footer">
          <button onClick={() => setGuide(true)} className="guide-button">
            <CircleHelp size={17} />
            칭찬핑 사용 가이드
            <ChevronRight size={14} />
          </button>
          {viewer?.role === "admin" && (
            <Link className="guide-button" href="/admin">
              <ShieldCheck size={17} />
              운영자 페이지
              <ChevronRight size={14} />
            </Link>
          )}
          {viewer ? (
            <div className="sidebar-user">
              <Link href="/profile">
                <Avatar name={viewer.chatNickname} index={viewer.avatar} />
                <span>
                  {viewer.chatNickname}
                  <small>칭찬핑 탐지 중</small>
                </span>
              </Link>
              <button aria-label="로그아웃" onClick={logout}>
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <button className="sidebar-login" onClick={() => setAuth("register")}>
              <UserRound size={19} />
              <span>가입하기</span>
              <ArrowRight size={16} />
            </button>
          )}
          <div className="sidebar-bottom">
            GOOD ACTIONS DESERVE A PING <PingIcon size={12} />
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-context">
            <PingIcon size={18} /> 함께 만드는, 서로를 칭찬하는 커뮤니티
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
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={refresh}>다시 연결</button>
            </div>
          )}
          {page === "home" && (
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
          {page === "send" && (
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
                {page === "received"
                  ? "나에게 도착한 마음을 열어볼까요?"
                  : "우리 아지트에 들어오세요"}
              </h1>
              <p>톡방 닉네임으로 로그인하고 칭찬핑을 이어가세요.</p>
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
                처음 오셨나요? 내 핑 등록하기
              </button>
            </div>
          )}
          {page === "received" && viewer && (
            <>
              <PageHeading
                eyebrow="함께한 순간, 고마웠던 행동"
                title="내가 받은 칭찬핑"
                description="누군가 당신의 좋은 행동을 발견했어요."
              />
              <div className="inbox-banner">
                <PingMark />
                <p>
                  <b>{viewer.chatNickname}님, 당신 덕분이에요.</b>
                  <span>
                    함께한 순간들이 {viewer.count}개의 따뜻한 마음으로
                    돌아왔어요.
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
          {page === "profile" && !needsLogin && (
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
                        우리 아지트의 소중한 한 사람
                      </div>
                      <h1>{profile.chatNickname}</h1>
                      <p>
                        게임 닉네임 <span>{profile.lolNickname}</span>
                      </p>
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
                    {profile.chatNickname}님에게 도착한 마음
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
          {page === "admin" && (
            <AdminView
              viewer={viewer}
              loading={loading}
              onLogin={() => setAuth("login")}
              refresh={refresh}
            />
          )}
          {page === "notfound" && (
            <Empty
              title="여기엔 아무도 와드를 박지 않았네요."
              text="길을 잃었어도 괜찮아요. 아지트로 돌아가볼까요?"
            >
              <Link className="primary-button" href="/">
                홈으로 돌아가기
              </Link>
            </Empty>
          )}
        </main>
        <footer className="main-footer">
          <span>좋은 행동을 알아보고, 서로를 더 존중하도록.</span>
          <span>
            CHINGCHANPING <span className="footer-dot">·</span> 서로에게 다정한
            플레이
          </span>
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
        mode={auth}
        setMode={setAuth}
        onSuccess={async () => {
          await refresh();
          setAuth(null);
        }}
      />
      {viewer && recipient && (
        <ComposeDialog
          member={recipient}
          onClose={() => setRecipient(null)}
          onSuccess={refresh}
        />
      )}
      <ReportDialog ping={report} onClose={() => setReport(null)} />
      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent className="hogam-dialog">
          <DialogTitle>칭찬핑, 이렇게 찍어요</DialogTitle>
          <DialogDescription>
            좋은 행동을 발견했다면, 구체적인 칭찬으로 알려주세요.
          </DialogDescription>
          <div className="guide-steps">
            <p>
              <b>01</b>
              <span>톡방 닉네임으로 내 핑 등록하기</span>
            </p>
            <p>
              <b>02</b>
              <span>고마웠던 사람을 찾아 선택하기</span>
            </p>
            <p>
              <b>03</b>
              <span>구체적인 행동을 떠올려 칭찬 남기기</span>
            </p>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={20} />
            <p>
              작성자는 다른 회원에게 공개되지 않아요. 악용 방지를 위해 운영자만
              작성 기록을 확인할 수 있어요.
            </p>
          </div>
          <p className="muted">
            한 사람에게는 1분에 한 번, 하루 3번까지, 전체 하루 10번까지 보낼 수
            있어요. 순위도, 경쟁도 없이 마음만 전해주세요.
          </p>
          <button
            className="primary-button full"
            onClick={() => setGuide(false)}
          >
            좋아요, 핑 찍으러 갈게요
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
  const [limit, setLimit] = useState(12);
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
        title="오늘도, 칭찬핑"
        description="좋은 행동을 발견했다면, 칭찬핑을 찍어주세요."
      >
        <Link className="primary-button" href="/send">
          <PingIcon size={19} />
          칭찬핑 보내기
          <ArrowRight size={17} />
        </Link>
      </PageHeading>
      <section className="board-section" aria-label="칭찬핑 보드">
        <div className="board-toolbar">
          <div className="board-title">
            <span className="live-dot" />
            <h2>우리 커뮤니티에 도착한 칭찬핑</h2>
            <span className="board-total">{stats.pings}</span>
          </div>
          <div className="board-controls">
            <Tabs value={filter} onValueChange={(value) => {
              setFilter(value);
              setDateError("");
              if (value === "all") {
                setAppliedRange("");
                setLimit(12);
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
                aria-label="공간으로 보기"
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
            setLimit(12);
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
              ? "이번 주 공감을 많이 받은 칭찬 최대 3개와 최신 칭찬을 모았어요. 공감 순위는 매주 월요일 0시(한국 시간)에 새로 시작해요."
              : "최근에 도착한 칭찬부터 보여드려요."}
          </p>
        )}
        {isExample && (
          <div className="example-label">
            <Sparkles size={13} />
            <span>첫 칭찬핑을 기다리는 중이에요. 아래는 칭찬 예시입니다.</span>
          </div>
        )}
        <div
          className={`ping-board ${mode === "list" ? "list-board" : "space-board"}`}
        >
          {mode === "space" && (
            <div className="board-map" aria-hidden="true">
              <div className="map-ring radar-inner" />
              <div className="map-ring radar-middle" />
              <div className="map-ring radar-outer" />
              <div className="map-cross vertical" />
              <div className="map-cross horizontal" />
              <div className="map-center">
                <PingMark />
                <span>좋은 행동, 칭찬으로 남기다</span>
              </div>
              <span className="map-plus plus-one">+</span>
              <span className="map-plus plus-two">+</span>
              <span className="map-dot dot-one" />
              <span className="map-dot dot-two" />
              <span className="map-dot dot-three" />
            </div>
          )}
          {loading ? (
            <Loading />
          ) : error ? (
            <Empty title="칭찬을 불러오지 못했어요" text="위의 다시 연결 버튼을 눌러주세요." />
          ) : filtered.length === 0 ? (
            <Empty
              title={
                appliedRange
                  ? "선택한 기간에 도착한 칭찬이 없어요."
                  : undefined
              }
              text="고마웠던 한 사람에게 칭찬을 남겨보세요."
            >
              <Link className="secondary-button" href="/send">
                사람 찾으러 가기 <ArrowRight size={16} />
              </Link>
            </Empty>
          ) : (
            <div className="board-cards">
              {filtered
                .slice(0, mode === "space" ? 6 : limit)
                .map((ping, i) => (
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
          <div className="board-coordinate" aria-hidden="true">
            OUR LITTLE UNIVERSE <span>✦</span>
          </div>
        </div>
        {mode === "list" && filtered.length > limit && (
          <button className="load-more" onClick={() => setLimit((l) => l + 12)}>
            칭찬핑 더 보기 <ArrowDown size={16} />
          </button>
        )}
        <div className="board-legend">
          <span>
            <span className="live-dot" />
            좋은 행동이 발견된 순간, 핑이 켜져요.
          </span>
          <span>
            <LockKeyhole size={13} />
            보내는 칭찬은 익명으로
          </span>
        </div>
      </section>
      <div className="home-bottom">
        <div className="community-stats">
          <div className="stats-icon">
            <Users size={23} />
          </div>
          <div>
            <b>같이 만드는 따뜻한 아지트</b>
            <p>
              <strong>{stats.members}</strong>명의 우리 <span>·</span> 오고 간
              마음 <strong>{stats.pings}</strong>개
            </p>
          </div>
          <div className="today-stat">
            <span>오늘 도착한 핑</span>
            <b>+{stats.today}</b>
          </div>
        </div>
        <button className="home-guide" onClick={onGuide}>
          <div>
            <span>처음 오셨나요?</span>
            <b>칭찬핑은 이렇게 찍어요</b>
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
        eyebrow="함께하는 사람의 좋은 점을 발견해요"
        title="누구에게 핑을 찍을까요?"
        description="오늘 함께해서 고마웠던 사람을 찾아보세요."
      />
      <div className="search-box">
        <Search size={21} />
        <input
          aria-label="톡방 닉네임 또는 게임 닉네임 검색"
          placeholder="톡방 닉네임이나 게임 닉네임으로 찾아보세요"
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
          탐지된 멤버 <b>{filtered.length}</b>명
        </span>
        <span>가나다순으로 보여드려요</span>
      </div>
      {loading ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty
          title={
            query
              ? "이 구역에서는 해당 유저가 탐지되지 않습니다."
              : "아직 함께할 멤버를 기다리고 있어요."
          }
          text={
            query
              ? "닉네임을 조금 다르게 검색해보세요."
              : "우리 커뮤니티 멤버들이 등록하면 이곳에 나타나요."
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
                  <p>{m.lolNickname}</p>
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
