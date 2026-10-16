import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { compareSync, hashSync } from "bcryptjs";

const root = path.resolve(".sites-runtime");
mkdirSync(root, { recursive: true });
const dataRoot = mkdtempSync(path.join(root, "password-reset-test-"));
const probe = createServer();
probe.listen(0, "127.0.0.1"); await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let child, db, checks = 0, logs = "", passed = false;
const pass = "Local-test-password-2026";
const next = "Member-reset-password-2026";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const row = (id) => db.prepare("SELECT * FROM users WHERE id=?").get(id);
const sessionCount = (id) => db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id=?").get(id).n;
const auditCount = () => db.prepare("SELECT COUNT(*) AS n FROM member_actions WHERE action='reset_password'").get().n;
function session(id) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(digest(token), id, Date.now() + 3600000);
  return `hogamping_session=${token}`;
}
async function request(route, body, cookie, expected = 200, extraHeaders = {}) {
  const response = await fetch(origin + "/api" + route, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json", Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${route}: ${JSON.stringify(data)}`);
  assert.match(response.headers.get("cache-control"), /no-store/);
  checks++;
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
// Pause only the isolated test server at precise DB boundaries. This makes
// credential/session races deterministic without production test hooks.
const serverCode = `
  import { register } from 'node:module';
  register('./scripts/cloudflare-loader.mjs', import.meta.url);
  const { env } = await import('./scripts/cloudflare-workers-shim.mjs');
  let armed, release;
  process.on('message', (message) => {
    if (message.arm) { armed = message.arm; process.send({ type: 'armed' }); }
    if (message.resume) { release?.(); release = undefined; }
  });
  async function pause(point) {
    if (armed !== point) return;
    armed = undefined;
    await new Promise((resolve) => { release = resolve; process.send({ type: 'paused' }); });
  }
  const prepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    const watch = (statement) => {
      const bind = statement.bind.bind(statement), first = statement.first.bind(statement);
      statement.bind = (...args) => watch(bind(...args));
      statement.first = async (...args) => { const row = first(...args); await pause('login-read'); return row; };
      return statement;
    };
    const statement = prepare(sql);
    return sql === 'SELECT * FROM users WHERE nickname_key=?' ? watch(statement) : statement;
  };
  const batch = env.DB.batch.bind(env.DB);
  env.DB.batch = async (statements) => {
    if (statements[0].sql.includes("'reset_password'")) await pause('reset-batch');
    if (statements[0].sql.startsWith('UPDATE users SET password_hash=')) await pause('password-batch');
    return batch(statements);
  };
  await import('./scripts/render-node-server.mjs');
`;
function message(type) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.off("message", receive); reject(Error(`No ${type} message: ${logs}`)); }, 10000);
    const receive = (value) => { if (value.type === type) { clearTimeout(timeout); child.off("message", receive); resolve(); } };
    child.on("message", receive);
  });
}
async function arm(point) { const ready = message("armed"); child.send({ arm: point }); await ready; }
function resetLimit() { db.prepare("DELETE FROM rate_limits WHERE key LIKE 'admin-password-reset:%'").run(); }
try {
  child = spawn(process.execPath, ["--input-type=module", "-e", serverCode], {
    env: { ...process.env, PORT: String(port), RENDER_DISK_PATH: dataRoot },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(logs);
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);
  db = new DatabaseSync(path.join(dataRoot, "chingchanping.sqlite"));
  const hash = hashSync(pass, 4);
  for (const id of ["admin", "other-admin", "member", "pending", "removed", "merged"]) {
    db.prepare("INSERT INTO users (id,chat_nickname,nickname_key,lol_nickname,password_hash,role,created_at,is_active,approval_status) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, `검증-${id}`, `검증-${id}`, "", hash, id.includes("admin") ? "admin" : "member", Date.now(), id === "removed" ? 0 : 1, id === "pending" ? "pending" : "approved");
  }
  db.prepare("UPDATE users SET merged_into='member',is_active=0 WHERE id='merged'").run();
  let admin = session("admin");
  const member = session("member"), anotherDevice = session("member"), pending = session("pending");
  const body = { userId: "member", chatNickname: "검증-member", currentPassword: pass, password: next, confirmPassword: next };
  const reset = (patch = {}, expected = 200, cookie = admin) => request("/admin/reset-password", { ...body, ...patch }, cookie, expected);
  await reset({}, 401, null); await reset({}, 403, member); await reset({}, 403, pending);
  await request("/admin/reset-password", body, admin, 403, { Origin: "https://other.invalid" });
  for (const patch of [{ currentPassword: "incorrect-password" }, { currentPassword: null }, { password: "short", confirmPassword: "short" }, { password: "가".repeat(25), confirmPassword: "가".repeat(25) }, { password: "x".repeat(65), confirmPassword: "x".repeat(65) }, { confirmPassword: pass }, { confirmPassword: null }]) {
    resetLimit(); await reset(patch, 400);
  }
  for (const [id, expected] of [["missing", 404], ["admin", 403], ["other-admin", 403], ["removed", 409], ["merged", 409]]) {
    resetLimit(); await reset({ userId: id, chatNickname: `검증-${id}` }, expected);
  }
  resetLimit(); await reset({ chatNickname: "변경전닉네임" }, 409);
  assert.equal(row("member").password_hash, hash); assert.equal(sessionCount("member"), 2); assert.equal(auditCount(), 0);
  // Hash, audit and sessions all roll back if the final revocation fails.
  db.exec("CREATE TRIGGER test_reset_failure BEFORE DELETE ON sessions WHEN OLD.user_id='member' BEGIN SELECT RAISE(ABORT,'injected_failure'); END");
  resetLimit(); await reset({}, 503);
  assert.equal(row("member").password_hash, hash); assert.equal(sessionCount("member"), 2); assert.equal(auditCount(), 0);
  db.exec("DROP TRIGGER test_reset_failure");
  const loginKey = `login-name:${digest("검증-member")}`;
  db.prepare("INSERT INTO rate_limits VALUES (?,8,?)").run(loginKey, Date.now() + 3600000);
  resetLimit(); assert.deepEqual((await reset()).data, { ok: true });
  const changedHash = row("member").password_hash;
  assert.match(changedHash, /^\$2[aby]\$12\$/); assert.ok(compareSync(next, changedHash)); assert.ok(!compareSync(pass, changedHash));
  assert.equal(sessionCount("member"), 0); assert.equal(sessionCount("admin"), 1); assert.equal(auditCount(), 1);
  assert.equal(db.prepare("SELECT key FROM rate_limits WHERE key=?").get(loginKey), undefined);
  for (const cookie of [member, anotherDevice]) await request("/home", undefined, cookie, 401);
  await request("/auth/login", { chatNickname: "검증-member", password: pass }, null, 401);
  const login = await request("/auth/login", { chatNickname: "검증-member", password: next });
  const signedIn = await request("/home", undefined, login.cookie);
  assert.equal(signedIn.data.viewer.id, "member");
  // Recovered members can change the assigned password in settings.
  const secondDevice = session("member");
  await request("/auth/password", { currentPassword: next, password: pass }, login.cookie);
  await request("/home", undefined, secondDevice, 401);
  await request("/home", undefined, login.cookie);
  assert.ok(compareSync(pass, row("member").password_hash));
  resetLimit(); await reset({ userId: "pending", chatNickname: "검증-pending" });
  assert.equal(row("pending").approval_status, "pending"); await request("/home", undefined, pending, 401);
  const pendingLogin = await request("/auth/login", { chatNickname: "검증-pending", password: next });
  await request("/received", undefined, pendingLogin.cookie, 403);
  const audit = (await request("/admin", undefined, admin)).data;
  const records = audit.actions.filter((item) => item.action === "reset_password");
  assert.equal(records.length, 2); assert.ok(records.every((item) => item.actor === "검증-admin"));
  for (const forbidden of [pass, next, "password_hash", "currentPassword", "confirmPassword"]) assert.equal(JSON.stringify(audit).includes(forbidden), false);
  // Login read the old hash before a reset completed: it cannot mint a session.
  await arm("login-read");
  let paused = message("paused");
  const staleLogin = request("/auth/login", { chatNickname: "검증-member", password: pass }, null, 401);
  await paused;
  resetLimit(); await reset(); child.send({ resume: true });
  await staleLogin; assert.equal(sessionCount("member"), 0);
  // A member's in-flight password change cannot undo a completed reset.
  const currentLogin = await request("/auth/login", { chatNickname: "검증-member", password: next });
  await arm("password-batch"); paused = message("paused");
  const staleChange = request("/auth/password", { currentPassword: next, password: pass }, currentLogin.cookie, 401);
  await paused;
  resetLimit(); await reset(); child.send({ resume: true });
  await staleChange; assert.ok(compareSync(next, row("member").password_hash));
  // Guard target role changes and revoked actor sessions inside the transaction.
  for (const mutation of ["promote", "revoke", "actor-password"]) {
    resetLimit(); const before = auditCount(), beforeHash = row("member").password_hash;
    await arm("reset-batch"); paused = message("paused");
    const staleReset = reset({}, mutation === "promote" ? 409 : 401);
    await paused;
    if (mutation === "promote") db.prepare("UPDATE users SET role='admin' WHERE id='member'").run();
    if (mutation === "revoke") db.prepare("DELETE FROM sessions WHERE user_id='admin'").run();
    if (mutation === "actor-password") db.prepare("UPDATE users SET password_hash=? WHERE id='admin'").run(hashSync("Changed-admin-password", 4));
    child.send({ resume: true }); await staleReset;
    assert.equal(auditCount(), before); assert.equal(row("member").password_hash, beforeHash);
    db.prepare("UPDATE users SET role='member' WHERE id='member'").run();
    db.prepare("UPDATE users SET password_hash=? WHERE id='admin'").run(hash);
    if (mutation === "revoke") admin = session("admin");
  }
  resetLimit();
  for (let i = 0; i < 5; i++) await reset({ currentPassword: "incorrect-password" }, 400);
  await reset({}, 429);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  passed = true;
  console.log(`PASS: ${checks} API responses plus admin reauthentication, validation, bcrypt, all-session revocation, login recovery, audit privacy, pending membership, rollback, rate limits and deterministic login/password-change/role/session races.`);
} finally {
  db?.close();
  if (child && child.exitCode === null) { const stopped = once(child, "exit"); child.kill(); await stopped; }
  if (passed && process.env.KEEP_PASSWORD_RESET_TEST_DATA === "1") {
    writeFileSync(path.join(root, "password-reset-test-latest.json"), JSON.stringify({ dataRoot }));
    console.log(`Local UI fixture: ${dataRoot}`);
  } else {
    if (!dataRoot.startsWith(root + path.sep)) throw Error("Unsafe test cleanup path");
    rmSync(dataRoot, { recursive: true, force: true });
  }
}
