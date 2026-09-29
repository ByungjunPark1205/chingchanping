# 가입 신청 이메일 알림

개인 도메인 없이 Google Apps Script의 MailApp으로 운영자 메일에 알립니다. 발신자는 설치한 구글 계정이며 수신자는 네이버 등 다른 메일 주소도 가능합니다. 사이트는 메일 서비스 오류와 관계없이 정상적으로 가입을 받습니다.

## 동작

- 구글 서버에서 15분 간격으로 승인 대기 회원을 확인합니다. PC를 켜놓을 필요는 없습니다. 실행이나 메일 전달이 지연될 수 있으므로 정확한 도착 시간은 보장되지 않습니다.
- 새 승인 대기 회원의 닉네임·신청 시각·관리자 페이지 링크를 한 통에 모아 보냅니다. 같은 신청은 반복 발송하지 않습니다. 처음 연결할 때는 현재 대기 중인 회원도 포함합니다.
- 확인 전에 승인·내보내기·계정 통합된 회원은 제외합니다. 알림 토큰은 승인 대기 목록만 읽을 수 있고 관리자 기능이나 칭찬·신고 내용에는 접근할 수 없습니다.
- 발송 실패나 일일 한도 소진 시 다음 실행에서 다시 시도합니다. 발송 직후 구글 속성 저장에 실패하면 드물게 중복 알림이 올 수 있습니다.
- 개인 구글 계정의 MailApp 한도는 하루 수신자 100명입니다. 한 번에 수신자 한 명에게 최대 15분마다 한 통씩 보내고, 매번 남은 한도를 확인합니다. 같은 구글 계정의 다른 스크립트도 이 한도를 공유합니다.

## 설정

1. Cloudflare Worker의 `SIGNUP_ALERT_TOKEN` 시크릿에 무작위 32바이트를 64자리 소문자 hex 문자열로 저장합니다. GitHub나 채팅에는 올리지 않습니다.
2. [Google Apps Script](https://script.google.com/home)에서 비공개 새 프로젝트를 만듭니다.
3. `integrations/google-apps-script/signup-alerts.gs`를 `Code.gs`에 붙여넣습니다. 프로젝트 설정에서 매니페스트 표시를 켜고 `appsscript.json`에는 같은 폴더의 매니페스트를 넣습니다.
4. 프로젝트 설정 → 스크립트 속성에 `SIGNUP_ALERT_TOKEN`과 `ALERT_TO`를 저장합니다. 전자는 Worker에 넣은 것과 같은 값, 후자는 알림을 받을 이메일 한 개입니다.
5. `installSignupAlerts` 함수를 선택하여 실행하고 본인 구글 계정으로 권한을 허용합니다. 외부 요청·메일 발송·이 프로젝트의 시간 트리거 권한을 사용합니다. 메일함 읽기 권한은 요구하지 않습니다.
6. 실행 로그의 연결 완료 안내와 트리거 목록의 `pollSignupAlerts` 15분 간격을 확인합니다. 대기 중인 회원이 있으면 실제 알림 메일을 확인합니다.

웹 앱으로 공개 배포할 필요는 없습니다. 프로젝트에는 연결용 시크릿이 있으므로 편집 권한을 공유하지 마세요. 메일 링크는 정상 관리자 로그인 후 승인 화면으로 이어지며 자동 승인 링크가 아닙니다.

연결 해제는 Apps Script에서 `pollSignupAlerts` 트리거를 삭제하고 Worker의 `SIGNUP_ALERT_TOKEN` 시크릿을 삭제하면 됩니다. 코드만 배포하고 시크릿을 설정하지 않으면 알림 조회 API는 503으로 비활성화됩니다.

## 검증

`npm run test:signup-alerts`는 실제 발송 없이 Google 서비스를 모의하여 배치·중복 방지·한도·실패 재시도를 확인합니다. `npm run test:members`는 알림 API의 인증과 제한된 응답 범위를 함께 검증합니다.

- [Google MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)
- [Google Apps Script 할당량](https://developers.google.com/apps-script/guides/services/quotas)
- [시간 기반 트리거](https://developers.google.com/apps-script/guides/triggers/installable)
