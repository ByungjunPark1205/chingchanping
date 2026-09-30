# 칭찬핑 · CHINGCHANPING

게임 커뮤니티에서 함께한 사람에게 익명으로 칭찬을 남기는 웹서비스입니다.

**[칭찬핑 이용하기](https://chingchanping.emile941205.workers.dev)**

현재 운영 환경은 **Cloudflare Workers + D1**입니다. 톡방 닉네임과 비밀번호로 가입하고, 관리자 승인 후 칭찬을 보내거나 공감할 수 있습니다.

## 주요 기능

| 구분 | 기능 |
| --- | --- |
| 가입·로그인 | 톡방 닉네임과 비밀번호로 가입, 승인 대기, 로그인 유지, 로그아웃 |
| 칭찬 보내기 | 회원 검색, 칭찬 유형 선택, 5~300자 익명 메시지 전송 |
| 홈 | 지도형 핑 배치와 스크롤 가능한 목록 보기, 전체·지정날짜 조회 |
| 공감·순위 | 칭찬마다 공감 1개와 취소, 이번 주 공감 상위 최대 3개와 최신 칭찬 |
| 받은 칭찬 | 받은 메시지 조회, 새 메시지 알림, 읽음 처리, 수신자 신고 |
| 설정 | 톡방 닉네임 변경, 게임 닉네임 선택 입력, 비밀번호 변경, 동작 줄이기 |
| 관리자 | 가입 승인, 내보내기·이용 복구, 중복 계정 통합, 관리자 지정, 신고 처리, 메시지 숨김·복원 |
| 가입 알림 | Google Apps Script를 연결해 승인 대기 회원을 이메일로 알림 |
| 링크 공유 | 사이트 제목·설명·미리보기 이미지 메타데이터 |

### 홈 화면

- 지도에는 수신자 이름과 핑을 표시합니다. 마우스를 올리거나 클릭·탭·키보드로 열면 메시지와 공감 버튼을 볼 수 있습니다.
- 핑은 흩어진 형태로 배치하며, 화면 크기와 핑 사이 간격에 맞춰 표시 개수를 조절합니다. 팝업은 지도 영역 안에서 위치를 조절합니다.
- 이번 주 공감 상위 1·2·3위는 핑 크기와 순위 표시로 구분합니다. 순위 칭찬 뒤에는 중복을 제외한 최신 칭찬을 보여주며, 순위가 없으면 최신 칭찬만 표시합니다.
- 목록 보기에서는 조회된 칭찬 전체를 내부 스크롤로 볼 수 있습니다.
- 날짜 필터는 칭찬 등록일에 적용하며 시작일과 마지막 날을 모두 포함합니다. 주간 순위는 한국 시간 월요일 00:00부터 다음 월요일 00:00 직전까지 받은 공감을 기준으로 합니다. 공감 0개는 순위에서 제외하고 동점이면 최근 칭찬을 먼저 표시합니다.

실제 칭찬이 없는 홈에는 예시임을 표시한 A·B·C 등의 데이터를 보여줍니다. 예시 회원은 DB와 통계에 포함되지 않으며 첫 실제 칭찬이 등록되면 예시는 사라집니다. 지도 배경과 핑은 직접 만든 SVG이며 네이비·청록·보라·금색을 사용합니다.

## 가입 승인과 관리자 기능

새 가입자는 승인 대기로 등록됩니다. 로그인과 설정은 가능하지만 칭찬 작성·공감·신고는 승인 후 가능하며, 승인 전에는 공개 회원 목록에 표시되지 않습니다.

관리자는 `/admin`에서 다음 작업을 할 수 있습니다.

- **가입 승인:** 톡방 회원인지 확인하고 활동을 허용합니다.
- **내보내기·이용 복구:** 로그인 세션을 종료하고 활동을 차단하거나 복구합니다. 내보낸 회원의 프로필과 받은 칭찬은 공개 목록에서 숨깁니다.
- **계정 통합:** 남길 계정의 닉네임과 비밀번호를 유지하고 칭찬·공감·신고 기록을 옮깁니다. 두 계정 모두 로그아웃되며 중복 공감은 한 건으로 계산합니다. 통합은 화면에서 되돌릴 수 없습니다.
- **관리자 지정:** 활동 중인 승인 회원에게 관리자 권한을 부여합니다. 관리자 계정은 내보내거나 통합할 수 없습니다.
- **신고 처리:** 신고된 칭찬의 작성자를 확인하고 메시지를 숨기거나 검토 완료로 처리합니다.

회원 관리 작업은 처리한 관리자와 함께 기록됩니다. 닉네임과 비밀번호만으로 가입하므로 동일인을 자동 판별하지는 않습니다. 자세한 동작은 [회원 관리와 신고 처리](docs/member-management.md)를 참고하세요.

### 최초 관리자 설정

새 DB에서 운영을 시작할 때만 필요한 절차입니다.

1. `ADMIN_SETUP_TOKEN`에 무작위 32바이트 이상의 비밀 키를 설정합니다. 로컬 개발은 `.dev.vars`, 운영 환경은 Cloudflare Worker 시크릿을 사용합니다.
2. 사이트에서 본인 계정을 만들고 로그인한 뒤 `/admin`에 접속합니다.
3. 초기 설정 키를 입력해 최초 관리자 계정을 등록합니다. 해당 계정은 함께 승인됩니다.
4. 이후 관리자는 회원 관리 화면에서 지정합니다. 최초 설정은 DB당 한 번만 가능합니다.

첫 가입자에게 관리자 권한을 자동으로 주지 않습니다. 초기 키는 공유하거나 GitHub에 올리지 않으며, 최초 등록 후 제거해도 관리자 기능은 유지됩니다.

## 익명성·신고·전송 제한

작성자 정보는 공개 보드, 개인 프로필, 받은 칭찬과 관리자 전체 칭찬 목록에 표시하지 않습니다. **수신자가 메시지를 신고하면 해당 신고를 확인하는 관리자에게만 작성자가 표시됩니다.** 신고한 수신자에게는 작성자를 공개하지 않으며, 신고 접수만으로 메시지를 자동으로 숨기지는 않습니다.

| 사용자 | 칭찬 전송 제한 |
| --- | --- |
| 일반 회원 | 동일 수신자에게 1분에 1개, 하루 3개 / 전체 수신자에게 하루 합계 10개 |
| 관리자 | 위 시간·횟수 제한 면제 |

하루 기준은 한국 시간 00:00입니다. 관리자도 자신이나 활동할 수 없는 계정에게 보낼 수 없으며 메시지 길이와 칭찬 유형 검사는 동일하게 적용됩니다.

- 비밀번호는 bcrypt cost 12로 해시합니다. 변경 시 다른 기기의 세션을 종료합니다.
- 세션 토큰은 256비트 무작위 값이며 DB에는 SHA-256 해시만 저장합니다. 쿠키에는 HttpOnly·SameSite=Lax를 적용하고 HTTPS에서는 Secure를 사용합니다.
- 로그인 유지 시 30일, 미선택 시 브라우저 세션 쿠키와 서버 기준 최대 24시간을 사용합니다.
- 쓰기 요청은 출처와 본문 크기를 검사하며 주요 인증·신고 API에는 별도 요청 제한을 적용합니다. 관리자 권한은 서버에서 검사합니다.
- 메시지 숨김은 기록을 보존하며 공개 보드·프로필·받은 칭찬·통계에서 제외합니다.

## 로컬 실행

Node.js **22.13 이상**과 npm이 필요합니다. 명령은 프로젝트 루트에서 실행합니다.

```sh
npm ci
cp .env.example .env
cp .env.example .dev.vars
```

`.env`와 `.dev.vars`의 `ADMIN_SETUP_TOKEN`에 같은 초기 설정 키를 넣습니다. 이메일 알림을 사용하지 않으면 `SIGNUP_ALERT_TOKEN`은 비워 둬도 됩니다.

### D1 마이그레이션 설정

현재 D1 이름은 `chingchanping-db`, 앱의 바인딩 이름은 `DB`입니다. 앱 연결은 `vite.config.ts`에 설정되어 있습니다. 마이그레이션 명령용으로 프로젝트 루트에 다음 `wrangler.d1.json`을 준비합니다. 별도 DB를 사용한다면 이 파일과 `vite.config.ts`의 DB 정보를 함께 변경합니다.

```json
{
  "name": "chingchanping",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "chingchanping-db",
      "database_id": "8b50268e-5e30-4633-accc-d6b90a7e2447",
      "migrations_dir": "drizzle"
    }
  ]
}
```

```sh
npx wrangler d1 migrations apply chingchanping-db --local --config wrangler.d1.json --persist-to .wrangler/state
npm run dev
```

개발 주소는 기본 `http://localhost:5173`입니다. 준비된 PC에서는 `start-chingchanping.cmd`를 더블클릭해 실행할 수 있습니다. 실행 창을 유지해야 사이트를 이용할 수 있습니다.

로컬 D1 데이터는 `.wrangler/state`에 저장하며 운영 D1과 별개입니다. 마이그레이션은 적용 이력을 기준으로 미적용 파일만 실행합니다. 이전에 SQL 파일을 직접 실행한 DB는 기존 적용 내역을 확인한 후 진행하세요. `npm run db:generate`는 스키마 변경 시 새 마이그레이션을 만드는 명령입니다.

## Cloudflare 배포

이 저장소의 운영 서비스는 Cloudflare Workers에서 실행하며 회원·칭찬·공감·신고는 D1에 저장합니다.

```sh
npx wrangler login
npm run build
```

DB 변경이 포함된 배포는 기존 데이터를 백업하고 위의 `wrangler.d1.json`을 사용해 미적용 마이그레이션부터 적용합니다.

```sh
npx wrangler d1 migrations apply chingchanping-db --remote --config wrangler.d1.json
npx wrangler deploy --config dist/server/wrangler.json --keep-vars --experimental-autoconfig=false
```

`dist/server/wrangler.json`은 빌드에서 생성되는 배포 설정입니다. 최초 운영자 키를 설정할 때는 다음 명령의 입력창에 값을 넣습니다.

```sh
npx wrangler secret put ADMIN_SETUP_TOKEN --config dist/server/wrangler.json
```

현재 마이그레이션은 초기 스키마(`0000`), 공감(`0001`), 가입 승인·회원 관리(`0002`), 관리자 지정(`0003`) 순서입니다. 기존 회원을 승인 상태로 유지합니다. GitHub 커밋·푸시와 Worker 배포는 별도 작업이며 Cloudflare 자동 배포를 연결한 경우 해당 빌드 결과를 확인해야 합니다.

### 가입 신청 이메일 알림

Google Apps Script가 15분 간격으로 승인 대기 회원을 확인해 지정한 이메일로 알립니다. 개인 도메인이나 PC 상시 실행은 필요하지 않으며 발송 시각은 지연될 수 있습니다.

Worker 시크릿과 Apps Script의 스크립트 속성에 같은 `SIGNUP_ALERT_TOKEN`을 설정합니다. 이 토큰은 무작위 32바이트를 변환한 **64자리 소문자 hex 값**이며 가입 대기 목록 조회에만 사용합니다. 자세한 설치 방법은 [가입 신청 이메일 알림](docs/signup-email-alerts.md)에 있습니다.

### Render 실행 지원

`render.yaml`과 `npm run start:render`도 유지하고 있습니다. 이 경로는 Node 서버와 SQLite를 사용하며 시작 시 미적용 마이그레이션을 자동 적용합니다. 기본 DB 경로는 `.render-data/chingchanping.sqlite`이고 `RENDER_DISK_PATH`로 변경할 수 있습니다. Render 로컬 파일의 데이터 보존을 위해서는 영구 디스크 등 별도 저장 구성이 필요합니다.

## 기술과 코드 구조

React·TypeScript, Next.js App Router 호환 Vinext, Tailwind CSS, shadcn/ui, Lucide, Cloudflare Workers·D1, Drizzle 마이그레이션을 사용합니다. DB 쿼리는 준비된 SQL 문으로 실행합니다.

```text
app/                              페이지, 메타데이터, 전역 스타일
app/api/[...path]/route.ts         API와 권한 검사
components/hogamping/             홈, 칭찬, 설정, 관리자 UI
lib/server/                       DB 접근, 인증, 회원 관리, 가입 알림
lib/types.ts                      공유 타입
db/schema.ts                      Drizzle 스키마
drizzle/                          SQL 마이그레이션
public/                           아이콘과 공유 미리보기 이미지
integrations/google-apps-script/  가입 알림 스크립트
scripts/                          실행 도구와 통합 검증
docs/                             운영 기능 상세 안내
vite.config.ts                    앱 빌드와 Cloudflare 바인딩
render.yaml                       Render용 서비스 설정
```

공개 보드·개인 페이지는 최근 500개, 관리자 칭찬·신고 목록은 최근 1,000개를 조회합니다. 날짜 조건과 주간 순위는 조회 개수 제한을 적용하기 전에 전체 DB를 대상으로 계산합니다. 지도 표시 개수는 화면 공간에 맞춰 줄어들 수 있으며 목록 보기에서 조회된 칭찬을 확인할 수 있습니다.

## 검증

```sh
npm run typecheck
npm run lint
npm run build
npm run test:members
npm run test:feed
npm run test:signup-alerts
```

`test:members`와 `test:feed`는 빌드 결과를 사용하는 임시 로컬 서버와 별도 DB에서 실행합니다. 가입 승인·권한·계정 통합·관리자 지정·신고 시 익명성·전송 제한과 관리자 예외·공감·순위·날짜 경계·재시작 후 저장을 검증합니다. `test:signup-alerts`는 Google 서비스를 모의하여 중복 방지·발송 한도·실패 재시도를 검사하며 실제 이메일을 보내지 않습니다.

WebMCP를 지원하는 브라우저에서는 `search_community_members`와 `start_compliment` 도구를 제공합니다. 후자는 칭찬 작성창을 열며 실제 전송은 사용자가 확인합니다.
