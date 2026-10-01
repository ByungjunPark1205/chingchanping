# 가입 신청·새 칭찬 이메일 알림

개인 도메인 없이 Google Apps Script의 MailApp으로 운영자 메일에 알립니다. 발신자는 설치한 구글 계정이며 수신자는 네이버 등 다른 메일 주소도 가능합니다. 사이트는 메일 서비스 오류와 관계없이 가입과 칭찬 등록을 처리합니다.

## 동작

- 구글 서버에서 15분 간격으로 승인 대기 회원과 새 칭찬을 확인합니다. PC를 켜놓을 필요는 없습니다. 실행이나 메일 전달이 지연될 수 있으므로 정확한 도착 시간은 보장되지 않습니다.
- 새 승인 대기 회원의 닉네임·신청 시각·관리자 페이지 링크를 한 통에 모아 보냅니다. 같은 신청은 반복 발송하지 않습니다. 처음 연결할 때는 현재 대기 중인 회원도 포함합니다.
- 새 칭찬은 수신자·유형·내용·등록 시각·사이트 링크를 보냅니다. **작성자와 신고 정보는 API와 이메일에 포함하지 않습니다.** 가입 요청과 칭찬이 함께 있으면 한 통에 모아 보냅니다.
- `0004_compliment_notifications.sql` 적용 이후 등록된 칭찬만 대상으로 하며 이전 칭찬은 발송하지 않습니다. 칭찬 저장과 알림 기록은 같은 트랜잭션에서 처리합니다. 등록 순서대로 한 번에 최대 100건을 확인하고 나머지는 다음 실행에서 이어서 처리합니다.
- 확인 전에 숨겨진 칭찬과 비활성·승인 대기·통합된 수신자의 칭찬은 건너뜁니다. 이후 복원하거나 계정을 통합해도 이전 칭찬을 다시 알리지 않습니다. 가입 요청도 승인·내보내기·통합된 회원은 제외합니다.
- 알림 토큰은 승인 대기 목록과 작성자를 제외한 새 칭찬만 읽을 수 있습니다. 관리자 권한, 작성자 확인, 신고 조회·처리는 허용하지 않습니다.
- 발송 실패나 일일 한도 소진 시 다음 실행에서 다시 시도합니다. 발송 직후 구글 속성 저장에 실패하면 드물게 중복 알림이 올 수 있습니다.
- 개인 구글 계정의 MailApp 한도는 하루 수신자 100명입니다. 한 번에 수신자 한 명에게 최대 15분마다 한 통씩 보내고, 매번 남은 한도를 확인합니다. 같은 구글 계정의 다른 스크립트도 이 한도를 공유합니다.

## 설정

1. Cloudflare Worker의 `SIGNUP_ALERT_TOKEN` 시크릿에 무작위 32바이트를 64자리 소문자 hex 문자열로 저장합니다. GitHub나 채팅에는 올리지 않습니다.
2. [Google Apps Script](https://script.google.com/home)에서 비공개 새 프로젝트를 만듭니다.
3. `integrations/google-apps-script/signup-alerts.gs`를 `Code.gs`에 붙여넣습니다. 프로젝트 설정에서 매니페스트 표시를 켜고 `appsscript.json`에는 같은 폴더의 매니페스트를 넣습니다.
4. 프로젝트 설정 → 스크립트 속성에 `SIGNUP_ALERT_TOKEN`과 `ALERT_TO`를 저장합니다. 전자는 Worker에 넣은 것과 같은 값, 후자는 알림을 받을 이메일 한 개입니다.
5. `installSignupAlerts` 함수를 선택하여 실행하고 본인 구글 계정으로 권한을 허용합니다. 외부 요청·메일 발송·이 프로젝트의 시간 트리거 권한을 사용합니다. 메일함 읽기 권한은 요구하지 않습니다.
6. 실행 로그의 연결 완료 안내와 트리거 목록의 `pollSignupAlerts` 15분 간격을 확인합니다. 대기 중인 회원이 있으면 실제 알림 메일을 확인합니다.

## 기존 가입 알림에 칭찬 알림 추가

1. 운영 D1에 `drizzle/0004_compliment_notifications.sql`을 적용하고 최신 Worker를 배포합니다.
2. 기존 Apps Script 프로젝트의 `Code.gs`를 저장소의 최신 `integrations/google-apps-script/signup-alerts.gs` 내용으로 교체하고 저장합니다.
3. `installSignupAlerts`를 한 번 실행합니다. 기존 `pollSignupAlerts` 트리거를 재사용하므로 중복 생성하지 않습니다. 필요한 구글 권한도 기존과 동일합니다.

`ALERT_TO`와 `SIGNUP_ALERT_TOKEN`은 기존 값을 유지합니다. `COMPLIMENT_ALERT_CURSOR`는 발송 완료 위치를 자동으로 저장하는 속성이므로 직접 만들거나 지우지 않습니다. 실패 시 위치를 유지해 다음 실행에서 다시 시도합니다. 기존 `notified:`와 `LAST_ALERT_AT` 속성도 보존합니다.

웹 앱으로 공개 배포할 필요는 없습니다. 프로젝트에는 연결용 시크릿이 있으므로 편집 권한을 공유하지 마세요. 메일 링크는 정상 관리자 로그인 후 승인 화면으로 이어지며 자동 승인 링크가 아닙니다.

연결 해제는 Apps Script에서 `pollSignupAlerts` 트리거를 삭제하고 Worker의 `SIGNUP_ALERT_TOKEN` 시크릿을 삭제하면 됩니다. 코드만 배포하고 시크릿을 설정하지 않으면 알림 조회 API는 503으로 비활성화됩니다.

## 검증

`npm run test:signup-alerts`는 실제 발송 없이 Google 서비스를 모의하여 가입·칭찬 묶음 발송, 작성자 비공개, 페이지 처리, 중복 방지, 한도와 실패 재시도를 확인합니다. `npm run test:compliment-alerts`는 임시 로컬 DB에서 기존 칭찬 제외, 원자적 알림 기록, 인증·권한, 작성자 비공개, 숨김·회원 상태, 복원·통합 시 중복 방지, 페이지 처리와 재시작 후 저장을 검증합니다. `npm run test:members`는 가입 알림 API의 인증과 응답 범위를 검증합니다.

- [Google MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)
- [Google Apps Script 할당량](https://developers.google.com/apps-script/guides/services/quotas)
- [시간 기반 트리거](https://developers.google.com/apps-script/guides/triggers/installable)
