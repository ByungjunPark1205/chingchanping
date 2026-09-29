import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the actual Apps Script with fake Google services; no emails are sent.
const source = readFileSync("integrations/google-apps-script/signup-alerts.gs", "utf8");
let now = Date.now(), status = 200, pending = [], quota = 100, failSend = false, failSave = false, locked = false, lockAvailable = true;
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
    assert.equal(url, "https://chingchanping.emile941205.workers.dev/api/notifications/signups");
    assert.equal(options.headers.Authorization, "Bearer " + "a".repeat(64));
    assert.equal(options.followRedirects, false);
    return { getResponseCode: () => status, getContentText: () => JSON.stringify({ pending }) };
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
console.log("PASS: signup email batching, fixed recipient, duplicate prevention, retry, quotas, credential checks, trigger idempotency and lock cleanup. No real mail sent.");
