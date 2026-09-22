# 칭찬핑 · CHINGCHANPING

좋은 행동을 발견했다면, 칭찬핑을 찍어주세요.

약 200명 규모의 게임 커뮤니티를 위한 익명 칭찬 서비스입니다. 순위나 인기투표 없이, 함께하는 사람의 좋은 행동을 발견하고 알려줍니다.

로컬에서는 브라우저에서 `http://localhost:5173`으로 이용합니다. Render에 배포할 때는 저장소의 `render.yaml`을 사용해 Node 웹 서비스로 실행합니다.

다음 실행 시 이 폴더의 **`start-chingchanping.cmd`**를 더블클릭하면 됩니다. 열린 실행 창을 유지하고 브라우저에서 위 주소를 여세요. 이미 실행 중이면 새로 실행할 필요가 없습니다.

## 구현된 기능

- 톡방 닉네임·게임 닉네임 등록, 로그인, 로그인 유지, 로그아웃
- bcrypt cost 12 비밀번호 해시, 비밀번호 변경 및 다른 기기 세션 만료
- 닉네임/게임 닉네임 검색, 가나다순 멤버 목록
- 5~300자 익명 칭찬, 마음 종류 선택, 전송 파동과 완료 안내
- 공간형/목록형 공개 보드, 오늘 필터, 개인 프로필 `/user/{id}`
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
4. 회원과 칭찬 데이터를 재시작 뒤에도 보존하려면 Render 유료 Web Service에 Persistent Disk를 `/var/data/chingchanping`으로 연결하세요. 연결하지 않으면 무료 인스턴스의 로컬 D1 파일은 재배포·재시작 때 초기화될 수 있습니다.

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

이미 적용한 SQL 마이그레이션을 다시 실행하지 마세요. 개발 주소는 기본 `http://localhost:5173`이며, 콘솔에 표시된 주소를 사용합니다. 로컬 DB는 `.wrangler/state`에 저장됩니다. 운영 데이터는 배포 서비스의 D1에 별도로 영구 저장됩니다.

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
```

검증 스크립트는 로컬 개발 서버가 실행되고 DB가 준비된 상태에서 순서대로 실행합니다. `test:api`는 `localhost`만 허용하며, 명시적으로 테스트용이라고 이름 붙인 3개 계정을 생성합니다. `test:limits`는 이 계정의 로컬 데이터를 사용합니다. 마지막 정리 스크립트는 기록된 테스트 계정 ID와 이름을 대조한 뒤 해당 데이터만 제거합니다. 운영 DB에서는 실행하지 않습니다.

검증 완료: 41개 API 경로/행동 검사, bcrypt 저장, 동시 전송 제한, 일일 제한, 권한 분리, 비밀번호 변경 후 세션 폐기, 읽음 처리 경쟁 조건, 모바일 전송 UI, 데스크톱/모바일 화면, WebMCP 정상/오류 경로.

브라우저가 WebMCP를 지원하면 `search_community_members`, `start_compliment` 도구를 제공합니다. 후자는 작성창만 열며 메시지를 자동 전송하지 않습니다.

공개 보드와 개인 페이지는 최근 500개, 관리 화면은 최근 1,000개의 기록을 조회하는 MVP 범위입니다. 데이터 자체는 영구 보관됩니다. 장기 운영에서 이 범위를 넘기면 서버 페이지네이션을 확장할 수 있습니다.
