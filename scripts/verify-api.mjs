import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

// Run only against the local preview. This creates disposable, clearly named QA accounts.
const origin = process.env.TEST_ORIGIN ?? "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
  throw new Error("Tests may only target localhost.");
const suffix = Date.now().toString(36);
const password = "QA-" + randomBytes(12).toString("hex");
const accounts = ["핑검증A", "핑검증B", "핑검증C"].map((name, i) => ({
  name: name + suffix,
  lol: `QA-${i}#TEST`,
  cookie: "",
  id: "",
}));
let checks = 0;
async function request(
  path,
  body,
  account,
  method,
  expected = 200,
  extra = {},
) {
  const response = await fetch(origin + "/api" + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      ...(body ? { "Content-Type": "application/json", Origin: origin } : {}),
      ...(account?.cookie ? { Cookie: account.cookie } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
  checks++;
  return { data, response };
}
const setupToken = readFileSync(".env", "utf8").match(
  /^ADMIN_SETUP_TOKEN=(.+)$/m,
)?.[1];
assert.ok(setupToken);
const [a, b, c] = accounts;
writeFileSync(
  ".sites-runtime/qa-state.json",
  JSON.stringify({ accounts, password }, null, 2),
);
for (const account of accounts) {
  const { response } = await request(
    "/auth/register",
    {
      chatNickname: account.name,
      lolNickname: account.lol,
      password,
      remember: true,
      role: "admin",
    },
    null,
    null,
    201,
  );
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=2592000/);
  account.cookie = cookie.split(";")[0];
  const home = await request("/home", null, account);
  account.id = home.data.viewer.id;
  assert.equal(home.data.viewer.role, "member");
  writeFileSync(
    ".sites-runtime/qa-state.json",
    JSON.stringify({ accounts, password }, null, 2),
  );
}
await request(
  "/compliments",
  {
    receiverId: b.id,
    message: "처음부터 먼저 게임에 초대해줘서 고마웠어요!",
    category: "따뜻하게 챙겨줘요",
  },
  null,
  null,
  401,
);
await request("/admin", null, b, null, 403);
await request(
  "/compliments",
  {
    receiverId: a.id,
    message: "나에게 보내는 칭찬 테스트입니다.",
    category: "함께해서 즐거워요",
  },
  a,
  null,
  400,
);
await request(
  "/compliments",
  {
    receiverId: b.id,
    message: "가".repeat(301),
    category: "함께해서 즐거워요",
  },
  a,
  null,
  400,
);
await request(
  "/compliments",
  {
    receiverId: b.id,
    message: "허용되지 않은 출처 테스트입니다.",
    category: "함께해서 즐거워요",
  },
  a,
  null,
  403,
  { Origin: "https://untrusted.example" },
);
const payload = {
  receiverId: b.id,
  message: "먼저 게임에 초대해줘서 고마웠어요. 덕분에 즐거운 한 판이었어요!",
  category: "따뜻하게 챙겨줘요",
};
const parallel = await Promise.all(
  [0, 1].map(() =>
    fetch(origin + "/api/compliments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: a.cookie,
      },
      body: JSON.stringify(payload),
    }),
  ),
);
assert.deepEqual(parallel.map((r) => r.status).sort(), [201, 429]);
checks++;
const sent = await parallel.find((r) => r.status === 201).json();
const publicHome = (await request("/home")).data;
const publicText = JSON.stringify(publicHome.pings);
for (const privateKey of [
  "sender_id",
  "senderId",
  "password_hash",
  "passwordHash",
  "nickname_key",
  "tokenHash",
])
  assert.equal(publicText.includes(privateKey), false, privateKey);
assert.equal(publicHome.pings.find((p) => p.id === sent.id).receiver.id, b.id);
const inbox = (await request("/received", null, b)).data;
assert.equal(inbox.pings[0].message, payload.message);
assert.ok((await request("/home", null, b)).data.viewer.unread > 0);
await request("/received/read", { lastSeenAt: inbox.pings[0].createdAt }, b);
assert.equal((await request("/home", null, b)).data.viewer.unread, 0);
await request(
  "/reports",
  { complimentId: sent.id, reason: "권한 없는 신고 테스트입니다." },
  c,
  null,
  403,
);
await request(
  "/reports",
  { complimentId: sent.id, reason: "운영자 검증을 위한 테스트 신고입니다." },
  b,
  null,
  201,
);
await request(
  "/reports",
  { complimentId: sent.id, reason: "중복 신고 검증입니다." },
  b,
  null,
  409,
);
await request("/admin/setup", { token: "invalid-setup-token" }, a, null, 403);
await request("/admin/setup", { token: setupToken }, a);
await request("/admin/setup", { token: setupToken }, b, null, 409);
const admin = (await request("/admin", null, a)).data;
assert.equal(admin.pings.find((p) => p.id === sent.id).sender, a.name);
assert.ok(admin.reports.length);
await request("/admin/action", { kind: "hide", id: sent.id }, a);
assert.equal(
  (await request("/home")).data.pings.some((p) => p.id === sent.id),
  false,
);
assert.equal(
  (await request("/received", null, b)).data.pings.some(
    (p) => p.id === sent.id,
  ),
  false,
);
await request("/admin/action", { kind: "restore", id: sent.id }, a);
assert.equal(
  (await request("/home")).data.pings.some((p) => p.id === sent.id),
  true,
);
await request("/admin/action", { kind: "deactivate", id: c.id }, a);
assert.equal((await request("/home", null, c)).data.viewer, null);
await request(
  "/auth/login",
  { chatNickname: c.name, password, remember: false },
  null,
  null,
  401,
);
await request("/admin/action", { kind: "activate", id: c.id }, a);
await request(
  "/auth/login",
  { chatNickname: b.name, password: "WrongPassword-12345" },
  null,
  null,
  401,
);
const bLogin = await request("/auth/login", {
  chatNickname: b.name,
  password,
  remember: false,
});
assert.equal(
  bLogin.response.headers.get("set-cookie").includes("Max-Age"),
  false,
);
const secondB = {
  ...b,
  cookie: bLogin.response.headers.get("set-cookie").split(";")[0],
};
await request(
  "/auth/password",
  { currentPassword: password, password: password + "x" },
  b,
);
assert.equal((await request("/home", null, secondB)).data.viewer, null);
await request(
  "/profile",
  { chatNickname: b.name, lolNickname: "UPDATED#QA" },
  b,
  "PATCH",
);
assert.equal(
  (await request("/users/" + b.id)).data.member.lolNickname,
  "UPDATED#QA",
);
const logout = await request("/auth/logout", {}, b);
assert.match(logout.response.headers.get("set-cookie"), /Max-Age=0/);
await request("/received", null, b, null, 401);
writeFileSync(
  ".sites-runtime/qa-state.json",
  JSON.stringify(
    { accounts, password, complimentId: sent.id, checks },
    null,
    2,
  ),
);
console.log(
  `PASS: ${checks} API checks; registration, sessions, privacy, concurrent throttling, reports, admin permissions, moderation, deactivation, password rotation, profiles, and logout.`,
);
