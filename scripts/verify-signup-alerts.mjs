import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the actual Apps Script with fake Google services; no emails are sent.
const source = readFileSync("integrations/google-apps-script/signup-alerts.gs", "utf8");
let now = Date.now(), status = 200, pending = [], quota = 100, failSend = false, failSave = false, locked = false, lockAvailable = true;
let complimentEvents = [], complimentStatus = 200, malformedCompliments = false;
const properties = {}, mails = [], triggers = [];
const props = {
  getProperty: (key) => properties[key] ?? null,
  getProperties: () => ({ ...properties }),
  deleteProperty: (key) => { delete properties[key]; },
  setProperties: (values) => { if (failSave) throw Error("storage unavailable"); Object.assign(properties, values); },
};
const context = vm.createContext({
  Date: class extends Date { static now() { return now; } },
  PropertiesService: { getScriptProperties: () => props },
  UrlFetchApp: { fetch: (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer " + "a".repeat(64));
    assert.equal(options.followRedirects, false);
    if (url.endsWith("/api/notifications/signups")) return { getResponseCode: () => status, getContentText: () => JSON.stringify({ pending }) };
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, "https://chingchanping.emile941205.workers.dev/api/notifications/compliments");
    const after = Number(parsed.searchParams.get("after"));
    const page = complimentEvents.filter((item) => item.sequence > after).slice(0, 100);
    const cursor = page.at(-1)?.sequence ?? after;
    const data = { compliments: page.map((item) => { const copy = { ...item }; delete copy.sequence; return copy; }), cursor, hasMore: complimentEvents.some((item) => item.sequence > cursor) };
    if (malformedCompliments) data.cursor = after - 1;
    return { getResponseCode: () => complimentStatus, getContentText: () => JSON.stringify(data) };
  } },
  LockService: { getScriptLock: () => ({ tryLock: () => { locked = lockAvailable; return locked; }, releaseLock: () => { locked = false; } }) },
  MailApp: { getRemainingDailyQuota: () => quota, sendEmail: (mail) => { if (failSend) throw Error("send unavailable"); mails.push(JSON.parse(JSON.stringify(mail))); quota--; } },
  Utilities: { formatDate: () => "09/29 12:00" },
  ScriptApp: { getProjectTriggers: () => triggers, newTrigger: (name) => ({ timeBased: () => ({ everyMinutes: (minutes) => {
    assert.equal(minutes, 15); return { create: () => triggers.push({ getHandlerFunction: () => name }) };
  } }) }) },
  console: { log() {} },
});
vm.runInContext(source, context);
const poll = () => context.pollSignupAlerts();
const advance = () => { now += 15 * 60000; };
const signup = (id, name = id) => ({ id, chatNickname: name, createdAt: now });
assert.throws(() => context.installSignupAlerts(), /SIGNUP_ALERT_TOKEN/);
properties.SIGNUP_ALERT_TOKEN = "a".repeat(64);
properties.ALERT_TO = "owner@example.com";
status = 401;
assert.throws(() => context.installSignupAlerts(), /401/);
assert.equal(triggers.length, 0);
status = 200; pending = [signup("one", "<b>회원A</b>"), signup("two", "회원B")];
context.installSignupAlerts();
assert.equal(triggers.length, 1); assert.equal(mails.length, 1);
assert.equal(mails[0].to, "owner@example.com");
assert.equal(mails[0].subject, "[칭찬핑] 가입 승인 요청 2건");
assert.ok(mails[0].body.includes("<b>회원A</b>")); assert.equal(mails[0].htmlBody, undefined);
assert.ok(mails[0].body.endsWith("/admin")); assert.equal(mails[0].body.includes(properties.SIGNUP_ALERT_TOKEN), false);
context.installSignupAlerts();
assert.equal(triggers.length, 1); assert.equal(mails.length, 1);
pending[0].chatNickname = "변경된 닉네임";
advance(); poll(); assert.equal(mails.length, 1);
pending.push(signup("three")); quota = 0; poll();
assert.equal(properties["notified:three"], undefined);
quota = 100; failSend = true;
assert.throws(poll, /send unavailable/); assert.equal(locked, false);
assert.equal(properties["notified:three"], undefined);
failSend = false; poll(); assert.equal(mails.length, 2);
pending.push(signup("four")); poll(); assert.equal(mails.length, 2);
advance(); status = 503;
assert.throws(poll, /503/); assert.equal(properties["notified:one"], "1");
status = 200; lockAvailable = false; poll(); assert.equal(mails.length, 2);
lockAvailable = true; poll(); assert.equal(mails.length, 3);
pending = []; advance(); poll(); assert.equal(properties["notified:one"], undefined);
assert.equal(properties.SIGNUP_ALERT_TOKEN, "a".repeat(64));
pending = [signup("five")]; failSave = true;
assert.throws(poll, /storage unavailable/); assert.equal(locked, false);
assert.equal(properties["notified:five"], undefined); // Retry is allowed after a persistence failure.
failSave = false; poll(); assert.equal(properties["notified:five"], "1");
pending = [{ id: "bad", chatNickname: "bad", createdAt: "not-a-date" }];
assert.throws(poll, /응답 형식/); assert.equal(properties["notified:five"], "1");
pending = []; advance();
const compliment = (sequence) => ({ sequence, id: "compliment-" + sequence, receiver: "회원B", message: "<b>게임 설명 고마워요.</b>", category: "매너가 좋아요", createdAt: now, sender: "PRIVATE-AUTHOR" });
complimentEvents.push(compliment(1)); poll();
assert.equal(mails.at(-1).subject, "[칭찬핑] 새 칭찬 1건");
assert.ok(mails.at(-1).body.includes("수신자: 회원B"));
assert.ok(mails.at(-1).body.includes("<b>게임 설명 고마워요.</b>"));
assert.equal(mails.at(-1).htmlBody, undefined);
assert.equal(JSON.stringify(mails.at(-1)).includes("PRIVATE-AUTHOR"), false);
assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "1");
const delivered = mails.length; advance(); poll(); assert.equal(mails.length, delivered);
complimentEvents.push(compliment(2)); pending = [signup("six")];
poll(); assert.equal(mails.length, delivered + 1);
assert.equal(mails.at(-1).subject, "[칭찬핑] 가입 승인 요청 1건 · 새 칭찬 1건");
assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "2");
complimentEvents.push(compliment(3)); quota = 0; advance(); poll();
assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "2");
quota = 100; failSend = true; assert.throws(poll, /send unavailable/);
assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "2"); assert.equal(locked, false);
failSend = false; poll(); assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "3");
complimentEvents.push(compliment(4)); advance(); failSave = true;
assert.throws(poll, /storage unavailable/); assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "3");
failSave = false; poll(); assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "4");
advance(); complimentStatus = 503; assert.throws(poll, /503/);
assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "4");
complimentStatus = 200; malformedCompliments = true; assert.throws(poll, /응답/);
assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "4"); malformedCompliments = false;
properties.COMPLIMENT_ALERT_CURSOR = "invalid"; assert.throws(poll, /조회 위치/);
properties.COMPLIMENT_ALERT_CURSOR = "4";
for (let i = 5; i <= 105; i++) complimentEvents.push(compliment(i));
poll(); assert.equal(mails.at(-1).subject, "[칭찬핑] 새 칭찬 100건");
assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "104");
const batches = mails.length; poll(); assert.equal(mails.length, batches);
advance(); poll(); assert.equal(properties.COMPLIMENT_ALERT_CURSOR, "105");
assert.equal(mails.at(-1).subject, "[칭찬핑] 새 칭찬 1건");
advance(); poll(); assert.equal(mails.length, batches + 1);
console.log("PASS: signup/compliment batching, author privacy, cursor pagination, fixed recipient, duplicate prevention, retry, quotas, credential checks, trigger idempotency and lock cleanup. No real mail sent.");
