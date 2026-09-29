// Run in a private, standalone Google Apps Script project. No web-app deployment.
// Script properties: SIGNUP_ALERT_TOKEN (64 hex characters), ALERT_TO (your inbox).
const CHINGCHANPING_URL = 'https://chingchanping.emile941205.workers.dev';
const SIGNUP_ALERT_INTERVAL = 15 * 60 * 1000;

function signupAlertConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty('SIGNUP_ALERT_TOKEN');
  const recipient = properties.getProperty('ALERT_TO');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error('SIGNUP_ALERT_TOKEN 스크립트 속성을 설정해주세요.');
  if (!recipient || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(recipient)) throw new Error('ALERT_TO 스크립트 속성에 받을 이메일 하나를 설정해주세요.');
  return { properties, token, recipient };
}

function fetchPendingSignups_(token) {
  const response = UrlFetchApp.fetch(CHINGCHANPING_URL + '/api/notifications/signups', {
    headers: { Authorization: 'Bearer ' + token },
    followRedirects: false,
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('칭찬핑 가입 알림 연결 실패: HTTP ' + response.getResponseCode());
  const data = JSON.parse(response.getContentText());
  if (!Array.isArray(data.pending) || data.pending.some(function (item) {
    return typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(item.id) || typeof item.chatNickname !== 'string' || !Number.isFinite(item.createdAt);
  })) throw new Error('가입 알림 응답 형식을 확인해주세요.');
  return data.pending;
}

// Select this function and click Run once, then allow the Google permissions.
function installSignupAlerts() {
  const config = signupAlertConfig_();
  fetchPendingSignups_(config.token);
  const exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'pollSignupAlerts';
  });
  if (!exists) ScriptApp.newTrigger('pollSignupAlerts').timeBased().everyMinutes(15).create();
  pollSignupAlerts();
  console.log('가입 알림 연결 완료. 15분 간격으로 확인합니다.');
}

function pollSignupAlerts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const config = signupAlertConfig_();
    const pending = fetchPendingSignups_(config.token);
    const saved = config.properties.getProperties();
    const currentIds = new Set(pending.map(function (item) { return item.id; }));
    // Remove old markers only after a complete, valid response from the site.
    Object.keys(saved).filter(function (key) { return key.indexOf('notified:') === 0 && !currentIds.has(key.slice(9)); })
      .forEach(function (key) { config.properties.deleteProperty(key); });
    const fresh = pending.filter(function (item) { return !saved['notified:' + item.id]; }).slice(0, 500);
    if (!fresh.length) return;
    const now = Date.now();
    if (now - Number(saved.LAST_ALERT_AT || 0) < SIGNUP_ALERT_INTERVAL) return;
    if (MailApp.getRemainingDailyQuota() < 1) {
      console.log('오늘 메일 한도를 사용했습니다. 다음 실행에서 다시 확인합니다.');
      return;
    }
    const lines = fresh.map(function (item) {
      return '- ' + item.chatNickname + ' (' + Utilities.formatDate(new Date(item.createdAt), 'Asia/Seoul', 'MM/dd HH:mm') + ')';
    });
    MailApp.sendEmail({
      to: config.recipient,
      name: '칭찬핑 가입 알림',
      subject: '[칭찬핑] 가입 승인 요청 ' + fresh.length + '건',
      body: '새 가입 신청이 있습니다.\n\n' + lines.join('\n') + '\n\n관리자 페이지에서 확인해주세요.\n' + CHINGCHANPING_URL + '/admin',
    });
    // Failures leave requests unmarked so the next run can retry.
    const updates = { LAST_ALERT_AT: String(now) };
    fresh.forEach(function (item) { updates['notified:' + item.id] = '1'; });
    config.properties.setProperties(updates, false);
    console.log('가입 알림 발송 완료: ' + fresh.length + '건');
  } finally {
    lock.releaseLock();
  }
}
