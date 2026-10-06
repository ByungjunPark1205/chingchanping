import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashSync } from "bcryptjs";

// All fixtures live in a temporary DB, separate from local and production data.
const testRoot = path.resolve(".sites-runtime");
mkdirSync(testRoot, { recursive: true });
const dataRoot = mkdtempSync(path.join(testRoot, "rankings-test-"));
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let child, db, cookie, logs = "", checks = 0;
async function request(route, body, session = cookie, expected = 200) {
  const response = await fetch(`${origin}/api${route}`, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json", Origin: origin } : {}), ...(session ? { Cookie: session } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${route}: ${JSON.stringify(data)}`);
  assert.match(response.headers.get("cache-control"), /no-store/);
  checks++;
  return { data, response };
}
try {
  child = spawn(process.execPath, ["scripts/render-start.mjs"], {
    env: { ...process.env, PORT: String(port), RENDER_DISK_PATH: dataRoot, ADMIN_SETUP_TOKEN: "rankings-test-setup-token" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(`Server exited: ${logs}`);
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Server startup timed out: ${logs}`);
  await request("/rankings", undefined, null, 401);
  await request("/rankings?metric=likes&start=2024-02-29&end=2024-02-29", undefined, "hogamping_session=invalid", 401);
  const html = await (await fetch(`${origin}/rankings`)).text();
  assert.equal(html.includes("순위테스트B"), false);
  db = new DatabaseSync(path.join(dataRoot, "chingchanping.sqlite"));
  const now = Date.now();
  const password = "Rankings-test-password-2026";
  const passwordHash = hashSync(password, 4);
  for (const id of ["A", "B", "C", "D", "E", "inactive", "pending", "merged"]) {
    db.prepare("INSERT INTO users (id,chat_nickname,nickname_key,lol_nickname,password_hash,created_at,is_active,approval_status) VALUES (?,?,?,?,?,?,?,?)")
      .run(id, `순위테스트${id}`, `순위테스트${id.toLowerCase()}`, `게임${id}`, passwordHash, now, id === "inactive" ? 0 : 1, id === "pending" ? "pending" : "approved");
  }
  db.prepare("UPDATE users SET merged_into='B' WHERE id='merged'").run();
  const login = await request("/auth/login", { chatNickname: "순위테스트A", password }, null);
  cookie = login.response.headers.get("set-cookie").split(";")[0];
  assert.deepEqual((await request("/rankings")).data, { metric: "count", start: null, end: null, rankings: [], totals: { members: 0, pings: 0, likes: 0 } });
  for (const query of ["metric=invalid", "metric=", "start=2024-02-29", "end=2024-02-29", "start=2024-02-30&end=2024-03-01", "start=2024-03-01&end=2024-02-29", "start=no&end=no"]) {
    await request(`/rankings?${query}`, undefined, cookie, 400);
  }
  const day = 86400000, target = Date.parse("2024-02-29T00:00:00+09:00");
  const insert = (id, receiver, stamp = target, hidden = 0) => db.prepare("INSERT INTO compliments (id,sender_id,receiver_id,message,category,created_at,is_hidden) VALUES (?,'A',?,'순위를 검증하는 칭찬입니다','매너가 좋아요',?,?)").run(id, receiver, stamp, hidden);
  const like = (id, user, stamp = now) => db.prepare("INSERT INTO compliment_likes VALUES (?,?,?)").run(id, user, stamp);
  insert("b-start", "B"); insert("b-end", "B", target + day - 1);
  insert("c-one", "C"); insert("c-two", "C"); insert("d-one", "D"); insert("e-zero", "E");
  insert("before", "D", target - 1); insert("after", "D", target + day);
  insert("hidden", "B", target, 1);
  for (const id of ["inactive", "pending", "merged"]) insert(`receiver-${id}`, id);
  for (const user of ["A", "B", "C"]) like("b-start", user);
  // Like timestamps do not filter likes on compliments received in the period.
  like("c-one", "A", target - day); like("c-two", "B", target + 5 * day);
  like("d-one", "C", target);
  for (const user of ["inactive", "pending", "merged"]) like("b-start", user);
  like("hidden", "A"); like("before", "A"); like("after", "A");
  const range = "start=2024-02-29&end=2024-02-29";
  const compact = (data) => data.rankings.map((row) => [row.member.id, row.rank, row.receivedCount, row.likesCount]);
  let counts = (await request(`/rankings?${range}`)).data;
  assert.deepEqual(compact(counts), [["B", 1, 2, 3], ["C", 1, 2, 2], ["D", 3, 1, 1], ["E", 3, 1, 0]]);
  assert.deepEqual(counts.totals, { members: 4, pings: 6, likes: 6 });
  assert.equal(counts.start, "2024-02-29"); assert.equal(counts.end, "2024-02-29");
  let likes = (await request(`/rankings?metric=likes&${range}`)).data;
  assert.deepEqual(compact(likes), [["B", 1, 2, 3], ["C", 2, 2, 2], ["D", 3, 1, 1]]);
  assert.deepEqual(likes.totals, counts.totals);
  for (const row of counts.rankings) {
    assert.deepEqual(Object.keys(row).sort(), ["likesCount", "member", "rank", "receivedCount"]);
    assert.deepEqual(Object.keys(row.member).sort(), ["avatar", "chatNickname", "count", "id", "lolNickname"]);
  }
  await request("/compliments/like", { complimentId: "d-one", liked: true });
  likes = (await request(`/rankings?metric=likes&${range}`)).data;
  assert.deepEqual(compact(likes), [["B", 1, 2, 3], ["C", 2, 2, 2], ["D", 2, 1, 2]]);
  await request("/compliments/like", { complimentId: "d-one", liked: false });
  const all = (await request("/rankings")).data;
  assert.equal(all.rankings[0].member.id, "D"); assert.equal(all.rankings[0].receivedCount, 3);
  assert.deepEqual((await request("/rankings?start=2024-01-01&end=2024-01-01")).data.totals, { members: 0, pings: 0, likes: 0 });
  const zeroLikes = (await request("/rankings?metric=likes&start=2024-03-01&end=2024-03-01")).data;
  assert.equal(zeroLikes.totals.pings, 1); // Remove its lone like and retain the compliment total.
  db.prepare("DELETE FROM compliment_likes WHERE compliment_id='after'").run();
  assert.deepEqual((await request("/rankings?metric=likes&start=2024-03-01&end=2024-03-01")).data.rankings, []);
  for (let i = 0; i < 505; i++) insert(`bulk-${i}`, "E");
  counts = (await request(`/rankings?${range}`)).data;
  assert.equal(counts.rankings[0].member.id, "E"); assert.equal(counts.rankings[0].receivedCount, 506);
  assert.equal(counts.totals.pings, 511);
  await request("/admin/setup", { token: "rankings-test-setup-token" });
  await request("/admin/action", { kind: "hide", id: "b-start" });
  counts = (await request(`/rankings?${range}`)).data;
  assert.equal(counts.rankings.find((row) => row.member.id === "B").receivedCount, 1);
  assert.equal(counts.rankings.find((row) => row.member.id === "B").likesCount, 0);
  await request("/admin/action", { kind: "restore", id: "b-start" });
  await request("/admin/action", { kind: "deactivate", id: "C" });
  counts = (await request(`/rankings?${range}`)).data;
  assert.equal(counts.rankings.some((row) => row.member.id === "C"), false);
  assert.equal(counts.rankings.find((row) => row.member.id === "B").likesCount, 2);
  await request("/auth/logout", {});
  await request("/rankings", undefined, cookie, 401);
  console.log(`PASS: ${checks} API responses plus full-DB member rankings, both metrics, shared ranks, Korean date boundaries, invalid ranges, like/unlike, moderation, eligible members/likes, zero scores and anonymity.`);
} finally {
  db?.close();
  if (child && child.exitCode === null) {
    const exit = once(child, "exit");
    child.kill(); await exit;
  }
  if (!path.resolve(dataRoot).startsWith(testRoot + path.sep)) throw Error("Unsafe test cleanup path");
  rmSync(dataRoot, { recursive: true, force: true });
}
