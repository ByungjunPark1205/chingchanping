// Private Apps Script project; existing pollSignupAlerts triggers remain valid.
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

function fetchAlertJson_(path, token) {
  const response = UrlFetchApp.fetch(CHINGCHANPING_URL + path, {
    headers: { Authorization: 'Bearer ' + token },
    followRedirects: false,
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('칭찬핑 메일 알림 연결 실패: HTTP ' + response.getResponseCode());
  return JSON.parse(response.getContentText());
}

function fetchPendingSignups_(token) {
  const data = fetchAlertJson_('/api/notifications/signups', token);
  if (!Array.isArray(data.pending) || data.pending.some(function (item) {
    return !item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(item.id) || typeof item.chatNickname !== 'string' || !Number.isFinite(item.createdAt);
  })) throw new Error('가입 알림 응답 형식을 확인해주세요.');
  return data.pending;
}

function fetchComplimentAlerts_(token, cursor) {
  if (!/^(0|[1-9]\d{0,15})$/.test(cursor) || !Number.isSafeInteger(Number(cursor))) throw new Error('칭찬 알림 조회 위치를 확인해주세요.');
  const data = fetchAlertJson_('/api/notifications/compliments?after=' + cursor, token);
  if (!Number.isSafeInteger(data.cursor) || data.cursor < Number(cursor) || typeof data.hasMore !== 'boolean' ||
      !Array.isArray(data.compliments) || data.compliments.length > 100 ||
      ((data.hasMore || data.compliments.length) && data.cursor <= Number(cursor)) ||
      data.compliments.some(function (item) {
        return !item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(item.id) ||
          typeof item.receiver !== 'string' || typeof item.message !== 'string' || typeof item.category !== 'string' ||
          !Number.isFinite(item.createdAt);
      })) throw new Error('칭찬 알림 응답 형식을 확인해주세요.');
  return data;
}

// Select this function and click Run once, then allow the Google permissions.
function installSignupAlerts() {
  const config = signupAlertConfig_();
  fetchPendingSignups_(config.token);
  fetchComplimentAlerts_(config.token, config.properties.getProperty('COMPLIMENT_ALERT_CURSOR') || '0');
  const exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'pollSignupAlerts';
  });
  if (!exists) ScriptApp.newTrigger('pollSignupAlerts').timeBased().everyMinutes(15).create();
  pollSignupAlerts();
  console.log('가입·칭찬 알림 연결 완료. 15분 간격으로 확인합니다.');
}

function pollSignupAlerts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const config = signupAlertConfig_();
    const saved = config.properties.getProperties();
    const pending = fetchPendingSignups_(config.token);
    const compliments = fetchComplimentAlerts_(config.token, saved.COMPLIMENT_ALERT_CURSOR || '0');
    const currentIds = new Set(pending.map(function (item) { return item.id; }));
    // Remove old markers only after complete, valid responses from both APIs.
    Object.keys(saved).filter(function (key) { return key.indexOf('notified:') === 0 && !currentIds.has(key.slice(9)); })
      .forEach(function (key) { config.properties.deleteProperty(key); });
    const fresh = pending.filter(function (item) { return !saved['notified:' + item.id]; }).slice(0, 500);
    if (!fresh.length && !compliments.compliments.length) {
      // Advance past hidden/inactive messages even when no email is needed.
      if (String(compliments.cursor) !== saved.COMPLIMENT_ALERT_CURSOR)
        config.properties.setProperties({ COMPLIMENT_ALERT_CURSOR: String(compliments.cursor) }, false);
      return;
    }
    const now = Date.now();
    if (now - Number(saved.LAST_ALERT_AT || 0) < SIGNUP_ALERT_INTERVAL) return;
    if (MailApp.getRemainingDailyQuota() < 1) {
      console.log('오늘 메일 한도를 사용했습니다. 다음 실행에서 다시 확인합니다.');
      return;
    }
    const sections = [], subjects = [];
    if (fresh.length) {
      const lines = fresh.map(function (item) {
        return '- ' + item.chatNickname + ' (' + Utilities.formatDate(new Date(item.createdAt), 'Asia/Seoul', 'MM/dd HH:mm') + ')';
      });
      subjects.push('가입 승인 요청 ' + fresh.length + '건');
      sections.push('새 가입 신청\n\n' + lines.join('\n') + '\n\n관리자 페이지\n' + CHINGCHANPING_URL + '/admin');
    }
    if (compliments.compliments.length) {
      const lines = compliments.compliments.map(function (item) {
        return '수신자: ' + item.receiver + '\n유형: ' + item.category +
          '\n등록: ' + Utilities.formatDate(new Date(item.createdAt), 'Asia/Seoul', 'MM/dd HH:mm') +
          '\n' + item.message;
      });
      subjects.push('새 칭찬 ' + compliments.compliments.length + '건');
      sections.push('새 칭찬\n\n' + lines.join('\n\n---\n\n') + '\n\n사이트에서 보기\n' + CHINGCHANPING_URL);
    }
    // One plain-text email for both kinds; never include author or report data.
    MailApp.sendEmail({
      to: config.recipient,
      name: '칭찬핑 알림',
      subject: '[칭찬핑] ' + subjects.join(' · '),
      body: sections.join('\n\n====================\n\n'),
    });
    // Only acknowledge after delivery. Failed sends retry the same cursor.
    const updates = { LAST_ALERT_AT: String(now), COMPLIMENT_ALERT_CURSOR: String(compliments.cursor) };
    fresh.forEach(function (item) { updates['notified:' + item.id] = '1'; });
    config.properties.setProperties(updates, false);
    console.log('메일 알림 발송 완료: 가입 ' + fresh.length + '건, 칭찬 ' + compliments.compliments.length + '건');
  } finally {
    lock.releaseLock();
  }
}
