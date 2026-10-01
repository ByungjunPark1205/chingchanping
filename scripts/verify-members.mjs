import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashSync } from "bcryptjs";

const root = path.resolve(".sites-runtime");
mkdirSync(root, { recursive: true });
const dataRoot = mkdtempSync(path.join(root, "members-test-"));
const db = new DatabaseSync(path.join(dataRoot, "chingchanping.sqlite"));
db.exec("PRAGMA foreign_keys=ON; CREATE TABLE _app_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)");
// Start with the deployed schema and existing accounts to verify upgrade compatibility.
for (const name of ["0000_wakeful_ser_duncan.sql", "0001_dear_human_torch.sql"]) {
  const sql = readFileSync(path.join("drizzle", name), "utf8");
  db.exec(sql);
  db.prepare("INSERT INTO _app_migrations VALUES (?,?)").run(name, createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex"));
}
const names = { admin: "테스트관리자", source: "중복회원", target: "남길회원", peer: "일반회원", removed: "내보낸회원", alternate: "다른회원" };
const pass = "Local-test-password-2026";
const sourcePass = "Source-only-password-2026";
const now = Date.now();
for (const [id, name] of Object.entries(names)) db.prepare("INSERT INTO users (id,chat_nickname,nickname_key,lol_nickname,password_hash,role,created_at,is_active,last_read_at) VALUES (?,?,?,?,?,?,?,?,?)")
  .run(id, name, name, "", hashSync(id === "source" ? sourcePass : pass, 4), id === "admin" ? "admin" : "member", now, id === "removed" ? 0 : 1, id === "source" ? 0 : now);

const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
const port = probe.address().port; await new Promise((r) => probe.close(r));
const origin = `http://127.0.0.1:${port}`;
let child, logs = "", checks = 0, passed = false;
async function start() {
  child = spawn(process.execPath, ["scripts/render-start.mjs"], { env: { ...process.env, PORT: String(port), RENDER_DISK_PATH: dataRoot, ADMIN_SETUP_TOKEN: "local-only-setup", SIGNUP_ALERT_TOKEN: "a".repeat(64) }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (s) => { logs += s; }); child.stderr.on("data", (s) => { logs += s; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(logs);
    try { if ((await fetch(origin)).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(logs);
}
async function request(route, body, cookie, expected = 200, headers = {}) {
  const response = await fetch(origin + "/api" + route, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json", Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); assert.equal(response.status, expected, `${route}: ${JSON.stringify(data)}`); checks++;
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
function session(id) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(createHash("sha256").update(token).digest("hex"), id, Date.now() + 3600000);
  return `hogamping_session=${token}`;
}
const row = (id) => db.prepare("SELECT * FROM users WHERE id=?").get(id);
const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const action = (kind, id, cookie, expected = 200) => request("/admin/action", { kind, id }, cookie, expected);
const mergeBody = { sourceId: "source", targetId: "target", sourceNickname: names.source, targetNickname: names.target };
try {
  await start();
  assert.equal(row("target").approval_status, "approved");
  const admin = session("admin"), peer = session("peer"), oldSource = session("source"), oldTarget = session("target");
  await request("/admin", null, null, 401); await request("/admin", null, peer, 403);
  await request("/admin/merge-preview?source=source&target=target", null, peer, 403);
  await request("/admin/merge", mergeBody, peer, 403);
  await request("/admin/merge", mergeBody, admin, 403, { Origin: "https://other.invalid" });
  const applicant = await request("/auth/register", { chatNickname: "승인대기회원", password: pass, approvalStatus: "approved", role: "admin" }, null, 201);
  let home = (await request("/home", null, applicant.cookie)).data;
  const applicantId = home.viewer.id;
  assert.equal(home.viewer.approvalStatus, "pending"); assert.equal(home.viewer.role, "member");
  const alertHeaders = { Authorization: `Bearer ${"a".repeat(64)}` };
  await request("/notifications/signups", null, null, 401);
  await request("/notifications/signups", null, admin, 401);
  await request("/notifications/signups", null, null, 401, { Authorization: `Bearer ${"b".repeat(64)}` });
  await request(`/notifications/signups?token=${"a".repeat(64)}`, null, null, 401);
  const alerts = (await request("/notifications/signups", null, null, 200, alertHeaders)).data;
  assert.equal(alerts.pending.length, 1);
  assert.deepEqual(Object.keys(alerts.pending[0]).sort(), ["chatNickname", "createdAt", "id"]);
  assert.equal(alerts.pending[0].id, applicantId);
  await request("/admin", null, null, 401, alertHeaders);
  assert.equal(home.members.some((u) => u.id === applicantId), false);
  assert.equal(home.stats.members, 5);
  await request(`/users/${applicantId}`, null, peer, 404);
  const message = { receiverId: "peer", message: "처음 하는 게임을 설명해줘서 고마웠어요.", category: "매너가 좋아요" };
  await request("/compliments", message, applicant.cookie, 403);
  await request("/compliments/like", { complimentId: "x", liked: true }, applicant.cookie, 403);
  await request("/received", null, applicant.cookie, 403);
  await action("approve", applicantId, peer, 403);
  await action("approve", "admin", admin, 403); await action("deactivate", "admin", admin, 403);
  await action("approve", applicantId, admin);
  assert.deepEqual((await request("/notifications/signups", null, null, 200, alertHeaders)).data.pending, []);
  assert.equal((await request("/home", null, applicant.cookie)).data.viewer.approvalStatus, "approved");
  await request("/compliments", message, applicant.cookie, 201);
  await action("approve", applicantId, admin, 409);
  await action("deactivate", applicantId, admin);
  await request("/home", null, applicant.cookie, 401);
  await request("/compliments", message, applicant.cookie, 401);
  await request("/auth/login", { chatNickname: "승인대기회원", password: pass }, null, 401);
  await request("/auth/register", { chatNickname: "승인대기회원", password: pass }, null, 409);
  await action("activate", applicantId, admin);
  await request("/home", null, applicant.cookie, 401);
  await request("/auth/login", { chatNickname: "승인대기회원", password: pass });
  await action("activate", "target", admin, 409);

  const insert = (id, sender, receiver, hidden = 0) => db.prepare("INSERT INTO compliments VALUES (?,?,?,?,?,?,?)").run(id, sender, receiver, `검증 칭찬 ${id}`, "매너가 좋아요", now - 5000, hidden);
  insert("incoming-source", "peer", "source"); insert("incoming-target", "peer", "target");
  insert("outgoing-source", "source", "peer"); insert("between", "source", "target"); insert("hidden", "peer", "source", 1);
  const like = (id, user, at) => db.prepare("INSERT INTO compliment_likes VALUES (?,?,?)").run(id, user, at);
  like("outgoing-source", "source", now - 14 * 86400000); like("outgoing-source", "target", now); like("incoming-target", "source", now);
  db.prepare("INSERT INTO reports VALUES (?,?,?,?,?,?)").run("source-report", "incoming-source", "source", "첫 번째 신고 사유", now - 300, "pending");
  db.prepare("INSERT INTO reports VALUES (?,?,?,?,?,?)").run("target-report", "incoming-source", "target", "두 번째 신고 사유", now - 200, "resolved");
  const beforeTargetHash = row("target").password_hash, beforePings = count("compliments");
  const preview = (await request("/admin/merge-preview?source=source&target=target", null, admin)).data;
  assert.equal(preview.source.receivedCount, 2); assert.equal(preview.duplicateLikes, 1); assert.equal(preview.betweenCompliments, 1);
  await request("/admin/merge", { ...mergeBody, targetId: "source" }, admin, 400);
  await request("/admin/merge", { ...mergeBody, targetId: "admin" }, admin, 403);
  await request("/admin/merge", { ...mergeBody, targetId: "removed" }, admin, 400);
  await request("/admin/merge", { ...mergeBody, targetId: "missing" }, admin, 404);
  await request("/admin/merge", { ...mergeBody, sourceNickname: "바뀐닉네임" }, admin, 409);
  const beforeActions = count("member_actions");
  // Inject a late failure: all earlier transfers and the audit insert must roll back.
  db.exec("CREATE TRIGGER test_merge_failure BEFORE UPDATE OF merged_into ON users WHEN NEW.id='source' BEGIN SELECT RAISE(ABORT,'injected_failure'); END");
  await request("/admin/merge", mergeBody, admin, 503);
  assert.equal(count("member_actions"), beforeActions); assert.equal(row("source").merged_into, null);
  assert.equal(db.prepare("SELECT receiver_id FROM compliments WHERE id='incoming-source'").get().receiver_id, "source");
  assert.equal(count("compliment_likes"), 3); assert.equal(count("reports"), 2);
  assert.equal((await request("/home", null, oldSource)).data.viewer.id, "source");
  db.exec("DROP TRIGGER test_merge_failure");
  const simultaneous = await Promise.all([fetch(origin + "/api/admin/merge", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: admin }, body: JSON.stringify(mergeBody) }), fetch(origin + "/api/admin/merge", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: admin }, body: JSON.stringify(mergeBody) })]);
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409]); checks += 2;
  assert.equal(count("compliments"), beforePings); assert.equal(count("member_actions"), beforeActions + 1);
  assert.equal(row("source").is_active, 0); assert.equal(row("source").merged_into, "target");
  assert.equal(row("target").password_hash, beforeTargetHash); assert.equal(row("target").last_read_at, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM compliments WHERE sender_id='source' OR receiver_id='source'").get().n, 0);
  assert.equal(count("compliment_likes"), 2);
  assert.equal(db.prepare("SELECT created_at FROM compliment_likes WHERE compliment_id='outgoing-source'").get().created_at, now - 14 * 86400000);
  assert.equal(count("reports"), 1);
  const report = db.prepare("SELECT * FROM reports").get(); assert.equal(report.reporter_id, "target"); assert.equal(report.status, "pending"); assert.match(report.reason, /첫 번째 신고 사유/); assert.match(report.reason, /두 번째 신고 사유/);
  for (const cookie of [oldSource, oldTarget]) await request("/home", null, cookie, 401);
  await request("/auth/login", { chatNickname: names.source, password: sourcePass }, null, 401);
  await request("/auth/login", { chatNickname: names.target, password: sourcePass }, null, 401);
  const targetLogin = await request("/auth/login", { chatNickname: names.target, password: pass });
  await request("/auth/register", { chatNickname: names.source, password: pass }, null, 409);
  await action("activate", "source", admin, 409); await action("restore", "between", admin, 400);
  const received = (await request("/received", null, targetLogin.cookie)).data.pings;
  assert.deepEqual(received.map((p) => p.id).sort(), ["incoming-source", "incoming-target"]);
  home = (await request("/home", null, admin)).data;
  assert.equal(home.members.some((u) => u.id === "source"), false);
  assert.equal(home.pings.some((p) => p.id === "between" || p.id === "hidden"), false);
  assert.equal(JSON.stringify(home).includes("password_hash"), false);
  assert.equal(JSON.stringify(home).includes("sourceNickname"), false);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  const adminData = (await request("/admin", null, admin)).data;
  assert.equal(adminData.actions.filter((a) => a.action === "merge").length, 1);
  // Keep one new applicant available for optional local UI verification.
  const pending = await request("/auth/register", { chatNickname: "새로운가입자", password: pass }, null, 201);
  const notificationPendingId = (await request("/home", null, pending.cookie)).data.viewer.id;
  await action("deactivate", notificationPendingId, admin);
  assert.deepEqual((await request("/notifications/signups", null, null, 200, alertHeaders)).data.pending, []);
  await action("activate", notificationPendingId, admin);
  const pendingLogin = await request("/auth/login", { chatNickname: "새로운가입자", password: pass });
  const pendingId = (await request("/home", null, pendingLogin.cookie)).data.viewer.id;
  await request("/admin/merge", { sourceId: "alternate", targetId: pendingId, sourceNickname: names.alternate, targetNickname: "새로운가입자" }, admin, 400);
  await request("/admin/setup", { token: "local-only-setup" }, pendingLogin.cookie, 409);
  // Author identities are released only in the admin report queue, after a
  // recipient reports. The reporter and public/member feeds remain anonymous.
  insert("report-private", "peer", "target");
  const reportBody = { complimentId: "report-private", reason: "비꼬는 표현이 있어 확인을 요청합니다." };
  const noAuthors = (items) => { for (const item of items) for (const key of ["sender", "senderId", "sender_id", "author", "reporter", "reason"]) assert.equal(Object.hasOwn(item, key), false, key); };
  let moderation = (await request("/admin", null, admin)).data;
  noAuthors(moderation.pings);
  assert.equal(moderation.users.some((u) => Object.hasOwn(u, "sentCount")), false);
  assert.equal(moderation.reports.some((r) => r.complimentId === "report-private"), false);
  await request("/reports", reportBody, null, 401);
  await request("/reports", reportBody, peer, 403);
  await request("/reports", reportBody, admin, 403);
  await request("/reports", reportBody, pendingLogin.cookie, 403);
  await request("/reports", reportBody, targetLogin.cookie, 403, { Origin: "https://other.invalid" });
  await request("/reports", { ...reportBody, reason: "짧음" }, targetLogin.cookie, 400);
  await request("/reports", { ...reportBody, complimentId: "missing" }, targetLogin.cookie, 403);
  await request("/reports", { ...reportBody, complimentId: "hidden" }, targetLogin.cookie, 403);
  const acknowledgement = await request("/reports", { ...reportBody, senderId: "admin", reporterId: "admin" }, targetLogin.cookie, 201);
  assert.deepEqual(acknowledgement.data, { ok: true });
  await request("/reports", reportBody, targetLogin.cookie, 409);
  moderation = (await request("/admin", null, admin)).data;
  const filedReport = moderation.reports.find((r) => r.complimentId === "report-private");
  assert.equal(filedReport.sender, names.peer); assert.equal(filedReport.receiver, names.target);
  assert.equal(filedReport.reporter, names.target); assert.equal(filedReport.reason, reportBody.reason);
  assert.equal(filedReport.status, "pending"); assert.equal(filedReport.isHidden, 0);
  noAuthors(moderation.pings);
  await request("/home", null, null, 401);
  await request("/users/target", null, null, 401);
  for (const viewerCookie of [pendingLogin.cookie, peer, targetLogin.cookie, admin]) {
    const feed = (await request("/home", null, viewerCookie)).data;
    noAuthors(feed.pings); noAuthors(feed.weeklyPings);
    noAuthors((await request("/users/target", null, viewerCookie)).data.pings);
  }
  noAuthors((await request("/received", null, targetLogin.cookie)).data.pings);
  await request("/admin", null, targetLogin.cookie, 403);
  await action("hide", "report-private", peer, 403);
  await action("hide", "report-private", admin);
  moderation = (await request("/admin", null, admin)).data;
  assert.equal(moderation.reports.find((r) => r.id === filedReport.id).status, "resolved");
  assert.equal(moderation.reports.find((r) => r.id === filedReport.id).isHidden, 1);
  assert.equal((await request("/home", null, admin)).data.pings.some((p) => p.id === "report-private"), false);
  // Leave a pending recipient report to inspect in the local UI.
  insert("report-ui", "peer", "target");
  await request("/reports", { ...reportBody, complimentId: "report-ui" }, targetLogin.cookie, 201);
  await action("promote", "peer", peer, 403);
  await action("promote", "peer", admin);
  assert.equal(row("peer").role, "admin");
  await action("promote", "peer", admin, 409);
  const promotionAdminData = (await request("/admin", null, admin)).data;
  assert.equal(promotionAdminData.actions.some((a) => a.action === "promote" && a.sourceNickname === names.peer), true);

  // Member limits remain atomic, even if a request claims administrator status.
  const limitedMember = session("alternate");
  const limitMessage = { ...message, receiverId: "target", role: "admin", isAdmin: true };
  const burst = await Promise.all(Array.from({ length: 4 }, () => fetch(origin + "/api/compliments", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: limitedMember }, body: JSON.stringify(limitMessage),
  })));
  assert.deepEqual(burst.map((response) => response.status).sort(), [201, 429, 429, 429]); checks += burst.length;
  const dayStart = Math.floor((Date.now() + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
  for (let i = 0; i < 9; i++) {
    db.prepare("INSERT INTO compliments VALUES (?,?,?,?,?,?,0)").run(`member-limit-${i}`, "alternate", i < 2 ? "target" : "peer", message.message, message.category, dayStart);
    if (i === 1) await request("/compliments", limitMessage, limitedMember, 429);
  }
  // A new recipient avoids the cooldown and recipient cap, isolating the daily total.
  await request("/compliments", { ...limitMessage, receiverId: "admin" }, limitedMember, 429);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM compliments WHERE sender_id='alternate'").get().n, 10);

  // Both original and newly appointed admins can exceed all three send limits.
  for (const [sender, cookie] of [["admin", admin], ["peer", peer]]) {
    const sent = db.prepare("SELECT COUNT(*) AS n FROM compliments WHERE sender_id=?").get(sender).n;
    for (let i = 0; i < 12; i++) await request("/compliments", { ...message, receiverId: "alternate" }, cookie, 201);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM compliments WHERE sender_id=?").get(sender).n, sent + 12);
  }
  await request("/compliments", { ...message, receiverId: "admin" }, admin, 400);
  await request("/compliments", { ...message, message: "짧음" }, admin, 400);
  await request("/compliments", { ...message, category: "없는 유형" }, admin, 400);
  await request("/compliments", { ...message, receiverId: pendingId }, admin, 404);
  await request("/compliments", { ...message, receiverId: "removed" }, admin, 404);
  await request("/compliments", { ...message, receiverId: "source" }, admin, 404);
  console.log(`PASS: ${checks} API checks plus assertions for migration, approval, removal, merge rollback/concurrency, recipient-only reports, admin-only author disclosure, member send limits, unlimited admin sending, likes and sessions.`);
  passed = true;
} finally {
  db.close();
  if (child && child.exitCode === null) { const ended = once(child, "exit"); child.kill(); await ended; }
  if (passed && process.env.KEEP_MEMBER_TEST_DATA === "1") {
    writeFileSync(path.join(root, "member-test-latest.json"), JSON.stringify({ dataRoot }));
    console.log(`Local UI fixture: ${dataRoot}`);
  } else {
    if (!path.resolve(dataRoot).startsWith(root + path.sep)) throw Error("Unsafe test cleanup path");
    rmSync(dataRoot, { recursive: true, force: true });
  }
}
