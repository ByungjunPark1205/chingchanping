import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(".sites-runtime");
mkdirSync(root, { recursive: true });
const dataRoot = mkdtempSync(path.join(root, "report-alert-test-"));
const db = new DatabaseSync(path.join(dataRoot, "chingchanping.sqlite"));
db.exec("PRAGMA foreign_keys=ON; CREATE TABLE _app_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)");
for (const name of ["0000_wakeful_ser_duncan.sql", "0001_dear_human_torch.sql", "0002_member_management.sql", "0003_admin_promotion.sql", "0004_compliment_notifications.sql", "0005_admin_password_reset.sql"]) {
  const sql = readFileSync(path.join("drizzle", name), "utf8");
  db.exec(sql);
  db.prepare("INSERT INTO _app_migrations VALUES (?,?)").run(name, createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex"));
}
for (const id of ["author", "receiver"]) db.prepare("INSERT INTO users (id,chat_nickname,nickname_key,lol_nickname,password_hash,role,created_at) VALUES (?,?,?,?,?,?,?)")
  .run(id, `PRIVATE-${id}`, id, "", "PRIVATE-HASH", id === "author" ? "admin" : "member", Date.now());
const insert = (id, status = "pending") => {
  db.prepare("INSERT INTO compliments (id,sender_id,receiver_id,message,category,created_at) VALUES (?,'author','receiver','PRIVATE-MESSAGE','매너가 좋아요',1)").run(id);
  db.prepare("INSERT INTO reports VALUES (?,?,'receiver','PRIVATE-REASON',?,?)").run(id, id, Date.now(), status);
};
insert("legacy-pending"); insert("legacy-resolved", "resolved");
function session(id) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(createHash("sha256").update(token).digest("hex"), id, Date.now() + 3600000);
  return `hogamping_session=${token}`;
}
const admin = session("author"), receiver = session("receiver");
const auth = { Authorization: "Bearer " + "a".repeat(64) };
const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let child, logs = "", checks = 0;
async function start(secret = true) {
  child = spawn(process.execPath, ["scripts/render-start.mjs"], {
    env: { ...process.env, PORT: String(port), RENDER_DISK_PATH: dataRoot, SIGNUP_ALERT_TOKEN: secret ? "a".repeat(64) : "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { logs += chunk; }); child.stderr.on("data", (chunk) => { logs += chunk; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(logs);
    try { if ((await fetch(origin)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(logs);
}
async function stop() {
  if (child && child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
}
async function request(route, expected = 200, headers = auth, body) {
  const response = await fetch(origin + "/api" + route, {
    method: body ? "POST" : "GET", headers: { ...headers, ...(body ? { Origin: origin, "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${route}: ${JSON.stringify(data)}`); assert.match(response.headers.get("cache-control"), /no-store/); checks++;
  return data;
}
const resetLimit = () => db.prepare("DELETE FROM rate_limits WHERE key='report-alert-reader'").run();
const alerts = (after = 0) => request(`/notifications/reports?after=${after}`);
try {
  await start(false); await request("/notifications/reports", 503);
  await stop(); await start();
  await request("/notifications/reports", 401, {});
  await request("/notifications/reports", 401, { Cookie: admin });
  await request("/notifications/reports", 401, { Authorization: "Bearer " + "b".repeat(64) });
  await request("/notifications/reports?token=" + "a".repeat(64), 401, {});
  const initial = await alerts();
  assert.deepEqual(initial.reports.map((report) => report.id), ["legacy-pending"]);
  assert.equal(initial.cursor, 1); assert.equal(initial.hasMore, false);
  for (const item of initial.reports) assert.deepEqual(Object.keys(item).sort(), ["createdAt", "id"]);
  for (const value of ["PRIVATE-author", "PRIVATE-receiver", "PRIVATE-MESSAGE", "PRIVATE-REASON", "PRIVATE-HASH", "sender", "reporter", "message", "reason"]) assert.equal(JSON.stringify(initial).includes(value), false);
  await request("/admin", 401); await request("/home", 401);
  await request("/admin/action", 401, auth, { kind: "resolve", id: "legacy-pending" });
  for (const value of ["-1", "01", "1.2", "1e2", "NaN", "9007199254740992", "999", ""]) { resetLimit(); await request(`/notifications/reports?after=${value}`, 400); }
  db.prepare("INSERT INTO compliments (id,sender_id,receiver_id,message,category,created_at) VALUES ('api-report','author','receiver','PRIVATE-MESSAGE','매너가 좋아요',1)").run();
  const body = { complimentId: "api-report", reason: "PRIVATE-REASON" };
  await request("/reports", 201, { Cookie: receiver }, body);
  resetLimit(); const fresh = await alerts(initial.cursor);
  assert.equal(fresh.reports.length, 1); assert.equal(fresh.cursor, 2);
  await request("/reports", 409, { Cookie: receiver }, body);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM report_notifications").get().n, 2);
  // Queueing fails atomically with report submission, so no report is lost.
  db.prepare("INSERT INTO compliments (id,sender_id,receiver_id,message,category,created_at) VALUES ('rollback','author','receiver','PRIVATE-MESSAGE','매너가 좋아요',1)").run();
  db.exec("CREATE TRIGGER test_report_failure BEFORE INSERT ON report_notifications BEGIN SELECT RAISE(ABORT,'injected_failure'); END");
  await request("/reports", 503, { Cookie: receiver }, { ...body, complimentId: "rollback" });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reports WHERE compliment_id='rollback'").get().n, 0);
  db.exec("DROP TRIGGER test_report_failure");
  await request("/admin/action", 200, { Cookie: admin }, { kind: "resolve", id: fresh.reports[0].id });
  assert.deepEqual(await alerts(initial.cursor), { reports: [], cursor: 2, hasMore: false });
  // A merge may delete a duplicate report: preserve its event as a tombstone.
  insert("deleted-report");
  db.prepare("DELETE FROM reports WHERE id='deleted-report'").run();
  assert.equal(db.prepare("SELECT report_id FROM report_notifications WHERE sequence=3").get().report_id, null);
  assert.deepEqual(await alerts(2), { reports: [], cursor: 3, hasMore: false });
  for (let i = 0; i < 205; i++) insert(`bulk-${i}`);
  resetLimit();
  const page1 = await alerts(3), page2 = await alerts(page1.cursor), page3 = await alerts(page2.cursor);
  assert.equal(page1.reports.length, 100); assert.equal(page1.hasMore, true);
  assert.equal(page2.reports.length, 100); assert.equal(page2.hasMore, true);
  assert.equal(page3.reports.length, 5); assert.equal(page3.hasMore, false);
  assert.equal(new Set([...page1.reports, ...page2.reports, ...page3.reports].map((report) => report.id)).size, 205);
  const cursor = page3.cursor;
  db.prepare("UPDATE reports SET status='resolved' WHERE id='legacy-pending'").run();
  assert.deepEqual(await alerts(cursor), { reports: [], cursor, hasMore: false });
  await stop(); await start(); resetLimit();
  assert.deepEqual(await alerts(cursor), { reports: [], cursor, hasMore: false });
  resetLimit(); for (let i = 0; i < 12; i++) await alerts(cursor);
  await request(`/notifications/reports?after=${cursor}`, 429);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  console.log(`PASS: ${checks} API responses plus pending-report backfill, atomic queueing/rollback, duplicate prevention, metadata-only notifications, resolved/deleted skipping, pagination, restart persistence and read-only credentials.`);
} finally {
  await stop(); db.close();
  if (!dataRoot.startsWith(root + path.sep)) throw Error("Unexpected test directory");
  rmSync(dataRoot, { recursive: true, force: true });
}
