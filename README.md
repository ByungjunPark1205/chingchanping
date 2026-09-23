# 칭찬핑 · CHINGCHANPING

좋은 행동을 발견했다면, 칭찬핑을 찍어주세요.

약 200명 규모의 게임 커뮤니티를 위한 익명 칭찬 서비스입니다. 함께하는 사람의 좋은 행동을 발견하고 알려줍니다.

로컬에서는 브라우저에서 `http://localhost:5173`으로 이용합니다. Render에 배포할 때는 저장소의 `render.yaml`을 사용해 Node 웹 서비스로 실행합니다.

다음 실행 시 이 폴더의 **`start-chingchanping.cmd`**를 더블클릭하면 됩니다. 열린 실행 창을 유지하고 브라우저에서 위 주소를 여세요. 이미 실행 중이면 새로 실행할 필요가 없습니다.

## 구현된 기능

- 톡방 닉네임·비밀번호 두 항목으로 가입, 로그인, 로그인 유지, 로그아웃 (게임 닉네임은 설정에서 선택 입력)
- bcrypt cost 12 비밀번호 해시, 비밀번호 변경 및 다른 기기 세션 만료
- 닉네임/게임 닉네임 검색, 가나다순 멤버 목록
- 5~300자 익명 칭찬, 마음 종류 선택, 전송 파동과 완료 안내
- 공간형/목록형 공개 보드, 전체/지정날짜(시작일·마지막 날 포함) 필터, 개인 프로필 `/user/{id}`
- 협곡에서 영감을 받은 독자적인 SVG 지도와 작은 핑: 마우스를 올리거나 탭·키보드로 열면 칭찬과 공감 버튼 표시
- 화면 너비에 따라 4개(1,250px 이하)·5개·6개(1,600px 이상)의 핑 표시, 네이비·청록·보라·금색 팔레트
- 계정당 칭찬별 공감 1개와 취소, 이번 주 공감 상위 최대 3개와 최신 칭찬
- 받은 칭찬, 새 칭찬 알림, 읽은 메시지 기준 알림 처리
- 신고 접수, 운영자의 작성자 확인, 메시지 숨김/복원, 신고 검토 완료
- 사용자 비활성화/활성화, 비활성화 시 세션 폐기
- 모바일 하단 내비게이션과 바텀시트, 동작 줄이기 설정

실제 데이터가 없는 홈에서는 **예시라고 표시한 칭찬 카드**를 보여줍니다. 예시 회원은 DB에 등록되지 않으며, 통계에도 포함되지 않습니다. 첫 실제 칭찬이 등록되면 예시는 자동으로 사라집니다.

## 운영 시작

1. 사이트에서 **로그인 → 내 핑 등록하기**로 본인의 계정을 만듭니다.
2. `/admin`에 접속합니다.
3. 이 작업 폴더의 `.env`에 있는 `ADMIN_SETUP_TOKEN` 값을 **초기 설정 키**에 입력합니다. 로컬 서버는 같은 키가 들어 있는 `.dev.vars`를 읽습니다.
4. 등록된 계정이 최초 운영자가 됩니다. DB의 단일 등록 기록으로 두 번째 운영자 초기 등록을 막습니다.

첫 회원가입자에게 자동으로 관리자 권한을 주지 않습니다. 초기 설정 키는 커뮤니티 회원에게 공유하지 마세요. 최초 등록 뒤 배포 환경에서 키를 제거해도 기존 관리자 기능은 유지됩니다.

## Render 배포

1. 이 저장소를 GitHub에 올린 뒤 Render에서 **New → Blueprint**로 저장소를 선택합니다.
2. `render.yaml`의 웹 서비스를 생성하고 `ADMIN_SETUP_TOKEN`에 무작위 초기 운영자 키를 입력합니다.
3. 서비스가 사용하는 포트는 Render의 `PORT`를 자동으로 읽습니다.
4. Render에서는 Node 서버와 SQLite로 실행하며, 시작 시 `drizzle/*.sql`의 미적용 마이그레이션을 자동 적용합니다. DB 기본 위치는 `.render-data/chingchanping.sqlite`입니다. 무료 인스턴스의 로컬 파일은 재배포·재시작 때 유실될 수 있습니다. 데이터 보존이 필요하면 별도의 영구 DB로 이전하거나, 유료 Persistent Disk를 연결하고 `RENDER_DISK_PATH`를 디스크 경로로 설정해야 합니다.

홈의 주간 순위는 한국 시간 월요일 00:00부터 일요일까지 받은 공감 수를 기준으로 합니다. 공감 0개인 칭찬은 순위에서 제외하며, 동점이면 최근 칭찬을 먼저 보여줍니다. 날짜 필터는 칭찬 등록일에 적용하고, 선택 기간 안의 칭찬 중 이번 주 공감 상위 최대 3개를 먼저 보여준 뒤 중복 없이 최신 칭찬을 이어 보여줍니다. 공감 수는 활성 계정의 공감만 포함하며, 누가 공감했는지는 공개하지 않습니다.

Render에서 공개 URL을 제공하더라도 앱의 닉네임/비밀번호 로그인과 Render 대시보드 접근 권한은 별개입니다. 초기 운영자 키는 커뮤니티 회원에게 공유하지 마세요.

## 실행

Node.js 22.13 이상과 npm이 필요합니다.

```sh
npm ci
# .env.example을 .env와 .dev.vars로 복사한 뒤,
# 각각 ADMIN_SETUP_TOKEN에 같은 무작위 32바이트 이상의 키를 설정합니다.
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wakeful_ser_duncan.sql
npm run dev
```

이미 적용한 SQL 마이그레이션을 다시 실행하지 마세요. 기존 로컬 D1 데이터베이스에는 새 공감 마이그레이션도 한 번 적용해야 합니다:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_dear_human_torch.sql
```

개발 주소는 기본 `http://localhost:5173`이며, 콘솔에 표시된 주소를 사용합니다. 로컬 개발 DB는 `.wrangler/state`, Render용 Node 서버의 DB는 `.render-data` 또는 `RENDER_DISK_PATH`에 별도로 저장됩니다. Render 무료 서비스의 데이터 영구 보존은 보장되지 않습니다.

현재 PC에는 npm 실행 파일이 기본 경로에 없어 프로젝트 내부에 보조 실행 도구를 준비했습니다. 이 PC에서는 다음과 같이 실행할 수도 있습니다.

```powershell
node .sites-runtime/tooling/node_modules/npm/bin/npm-cli.js run dev
```

## 구조

```text
app/                         페이지, 메타데이터, 전역 스타일
app/api/[...path]/route.ts    서버 API와 권한 검사
components/hogamping/
  app.tsx                    공통 셸, 홈 보드, 멤버 목록
  cards.tsx                  칭찬 카드와 목록
  dialogs.tsx                로그인·등록·칭찬·신고 대화상자
  admin.tsx                  운영자 화면
  settings.tsx               프로필·비밀번호·동작 설정
  common.tsx                 제목·빈 상태·로딩
  visuals.tsx                직접 디자인한 핑 마커와 아바타
lib/server/                  DB 접근, 인증, 공개 데이터 직렬화
lib/types.ts                 공유 타입
db/schema.ts                 Drizzle 스키마
drizzle/                     버전 관리되는 SQL 마이그레이션
scripts/verify-*.mjs          로컬 통합 검증
```

React/TypeScript, Next.js App Router 호환 Vinext, Tailwind CSS, shadcn/ui, Lucide, Cloudflare Workers/D1(SQLite), Drizzle migrations를 사용합니다. 사이트의 원격 실행 환경에 맞춰 Next.js 호환 프레임워크를 선택했습니다. 데이터 쿼리는 준비된 SQL 문으로 수행합니다.

## 익명성과 악용 방지

- 작성자 ID는 DB에만 보존하고, 공개·프로필·받은 칭찬 응답에서는 명시적인 필드 선택으로 제외합니다.
- 관리자 API는 매 요청마다 서버에서 역할을 검사합니다. 비밀번호 해시와 세션 정보는 관리자 화면에도 반환하지 않습니다.
- 세션은 256비트 무작위 토큰입니다. DB에는 SHA-256 해시만 저장하며, 쿠키에는 HttpOnly, SameSite=Lax, HTTPS에서 Secure를 적용합니다.
- 로그인 유지 시 30일, 미선택 시 브라우저 세션 쿠키와 서버 기준 최대 24시간을 사용합니다.
- 쓰기 요청은 출처 검사와 JSON 본문 제한을 적용합니다. 비밀번호는 bcrypt의 잘림을 막기 위해 UTF-8 72바이트 이하로 제한합니다.
- 동일 대상 1분에 1개, 동일 대상 하루 3개, 전체 하루 10개까지 가능합니다. 하루 기준은 한국 시간 00:00입니다. 제한 검사와 저장은 하나의 SQL 문으로 처리합니다.
- 로그인, 등록, 비밀번호 변경, 신고, 초기 운영자 설정에는 별도 요청 제한을 적용합니다.
- 받은 사람만 해당 칭찬을 신고할 수 있으며, 중복 신고는 막습니다.
- 메시지 삭제는 운영 기록을 보존하는 숨김 처리입니다. 숨긴 메시지는 공개 보드·프로필·받은 칭찬·통계에서 제외됩니다.

## 검증

```sh
npm run typecheck
npm run test:api
npm run test:limits
npm run test:cleanup
npm run build
npm run test:feed
```

검증 스크립트는 로컬 개발 서버가 실행되고 DB가 준비된 상태에서 순서대로 실행합니다. `test:api`는 `localhost`만 허용하며, 명시적으로 테스트용이라고 이름 붙인 3개 계정을 생성합니다. `test:limits`는 이 계정의 로컬 데이터를 사용합니다. 마지막 정리 스크립트는 기록된 테스트 계정 ID와 이름을 대조한 뒤 해당 데이터만 제거합니다. 운영 DB에서는 실행하지 않습니다.

검증 완료: 41개 API 경로/행동 검사, bcrypt 저장, 동시 전송 제한, 일일 제한, 권한 분리, 비밀번호 변경 후 세션 폐기, 읽음 처리 경쟁 조건, 모바일 전송 UI, 데스크톱/모바일 화면, WebMCP 정상/오류 경로.

브라우저가 WebMCP를 지원하면 `search_community_members`, `start_compliment` 도구를 제공합니다. 후자는 작성창만 열며 메시지를 자동 전송하지 않습니다.

공개 보드와 개인 페이지는 최근 500개, 관리 화면은 최근 1,000개의 기록을 조회합니다. 날짜 필터와 주간 순위는 이 제한을 적용하기 전에 전체 DB를 대상으로 계산합니다. `test:feed`는 별도 임시 DB와 로컬 Node 서버를 만들어 공감·순위·날짜 경계·익명성·재시작을 검증한 뒤 테스트 데이터를 제거합니다. 장기 운영에서 목록 범위를 넘기면 서버 페이지네이션을 확장할 수 있습니다.
