# 작업 흐름

코드를 고쳐 PR로 올리기까지 지키는 규칙. Recipe·Archetype을 더하거나 고치면 [`docs/recipes.md`](../recipes.md)와 [`docs/archetypes.md`](../archetypes.md)를, 의존성 버전을 올리면 [의존성 버전 올리기](../release.md#의존성-버전-올리기)를 함께 읽는다.

## 테스트: 하네스

테스트의 seam은 하네스(`harness/*.test.ts`, 레포 최상위의 `npm test`) 하나다. 하네스는 Generator를 `npm pack`으로 묶어 설치한 진짜 `dcgen` CLI로 운영체제의 임시 디렉터리에 Starter를 만들고, 그 Starter의 npm 스크립트와 E2E를 실행한다(`harness/global-setup.ts`, `harness/starter.ts`).

- Generator 코드(`packages/devc-frontend-generator/src`)는 `dcgen`과 만들어진 Starter에서 보이는 동작으로 시험한다. 내부 함수의 단위 테스트는 두지 않는다.
- Recipe·Archetype의 동작은 Starter에 함께 넣는 자기 테스트(단위·컴포넌트 테스트, `e2e/*.spec.ts`)가 시험하고, 하네스에는 Recipe·Archetype마다 조합 매트릭스 파일을 둔다([Recipe의 테스트](../recipes.md#테스트), [Archetype의 테스트](../archetypes.md#테스트)).
- 기능을 더하든 버그를 고치든 하네스 테스트를 먼저 쓰고, 고치기 전에 그 테스트가 실패(red)하는 것을 확인한다.

### 실행

- 하네스 파일은 하나만 돌려도 Generator를 빌드·팩·설치하고 대개 Starter까지 설치하므로 몇 분에서 수십 분이 걸린다. 작업하는 동안에는 고친 영역의 파일만 백그라운드로 돌린다: `npx vitest run harness/<이름>.test.ts`.
- 전체 하네스를 러너 한 대에서 돌리면 한 시간쯤 걸린다. 그래서 CI는 하네스 파일을 여섯 묶음으로 나눠 동시에 돌리고(`Harness (1/6)`~`(6/6)` 잡, 묶음마다 테스트 단계가 12분 안팎), `Typecheck and harness` 잡이 타입 검사와 여섯 묶음의 결과를 모아 알린다. 실패한 테스트는 그 묶음의 잡 로그에서 본다. 로컬에서는 여러 영역에 걸친 변경을 확인해야 할 때만 `npm test`를 돌린다.
- 하네스 파일은 파일별 소요 시간 기록(`harness/durations.json`)을 보고 묶음마다 시간이 고르도록 나눈다(`harness/sequencer.ts`). 기록에 없는 새 하네스 파일은 기록된 시간의 중앙값으로 쳐서 어느 한 묶음에 넣는다. 하네스 파일을 더하거나 지워 묶음마다 시간이 벌어지면, 성공한 CI 실행을 두어 개 골라(`gh run list --workflow ci.yml --status success`) `npm run harness:durations -- <실행 ID>...`로 기록을 다시 만들어 커밋한다. 스크립트는 `gh`로 그 실행의 잡 로그를 받아 Vitest가 파일마다 찍은 시간을 읽고, 실행이 여럿이면 평균을 쓴다.
- `npm run typecheck`(하네스, 스크립트, Generator)는 금방 끝나므로 고칠 때마다 돌린다.

### 외부 서비스

테스트와 하네스가 Sentry나 분석 서비스로 보내는 데이터는 하네스가 띄운 로컬 가짜 서버가 받게 한다(`harness/sentry.test.ts`는 DSN을 `127.0.0.1`의 가짜 수집 서버로 가리킨다). 진짜 서비스의 DSN이나 키는 테스트에 쓰지 않는다.

## Showcase

`apps/showcase/`는 Generator(`packages/devc-frontend-generator/`)가 만든 생성 결과다([Showcase](../recipes.md#showcase)).

- Base, Rendering Mode, Recipe, Archetype, Generator 코드처럼 만들어지는 Starter를 바꾸는 파일을 고쳤으면 `npm run showcase`로 다시 만들고, 원본 변경과 따로 `chore: regenerate the Showcase with …` 커밋으로 올린다.
- Showcase의 파일을 바꿔야 하면 그 파일 맨 위 주석이 알리는 원본을 고치고 다시 만든다.
- `npm run showcase:check`가 통과해야 한다. CI의 `Showcase drift` 잡이 같은 검사를 한다.

## changeset

Generator 사용자에게 보이는 변경에는 `.changeset/*.md`를 함께 커밋한다. 언제 필요한지와 버전 종류(`patch`·`minor`)는 [changeset 더하기](../release.md#changeset-더하기)를 따른다.

- 요약은 CHANGELOG에 그대로 실린다. 한국어로, Starter를 쓰는 사람에게 무엇이 달라지는지 쓴다.
- 이미 만든 Starter는 새 Generator 버전을 저절로 받지 않는다. 기존 Starter가 손으로 옮겨야 하는 변경이면 옮기는 방법도 적는다(예: `.changeset/msw-mock-optional-properties.md`).

## 함수 나누기

Generator 코드와 Starter 코드(Base, Rendering Mode, Recipe, Archetype, Schematic이 만드는 코드)에 함께 적용한다.

- 한 곳에서만 부르는 로직은 함수로 빼지 않고 부르는 함수 안에 둔다. 함수가 길어져도 된다. 단계는 빈 줄과 주석으로 나눈다.
- 이름 있는 함수로 따로 두는 것은 다음 경우다.
  - 두 곳 이상에서 부른다.
  - 재귀하거나, 콜백으로 넘기거나, 값으로 담아 둔다.
  - React의 규칙 때문에 컴포넌트여야 한다(목록 항목마다 훅을 따로 가져야 하는 것, `<Suspense>`가 기다릴 async 서버 컴포넌트 등).
  - 특정 기능에 묶이지 않은 범용 로직이다(글자·경로·빈 값 처리, 파일 읽기 등). 한 곳에서만 쓰더라도 공용 유틸 모듈에 두고, 더하기 전에 같은 일을 하는 유틸이 이미 있는지 찾는다.
    - Generator: `packages/devc-frontend-generator/src/utils/`에 주제별 파일로 둔다(`fs.ts`, `text.ts`, `names.ts`, `type-guards.ts`, `collections.ts`, `terminal.ts`).
    - Starter: Base의 `src/shared/lib/`에 주제별 파일로 두고 테스트를 함께 둔다. 서버, 브라우저, `config/`의 설정 어디서나 불러오도록 실행 위치 표시(`server-only` 등)가 없는 순수 함수만 둔다. Recipe의 범용 함수는 같은 디렉터리에 자기 파일로 더한다.
  - Schematic이 만드는 파일의 소스(`<파일>Source`)가 길어서 Schematic 함수 안에 두면 검사 코드와 여러 파일의 내용이 섞일 때. 짧은 소스는 `newModules`에 바로 적는다.

## 커밋과 PR

- 커밋은 Conventional Commits를 따른다. 제목은 영어로, 본문은 한국어로 왜 바꿨는지 쓴다. 이슈는 본문 끝에 `Refs #N`(관련)이나 `Closes #N`(해결)으로 잇는다.
- 코드 주석은 한국어로 코드가 왜 그런지 쓰고, 주석을 다는 정도는 주변 코드에 맞춘다.
- PR은 기본 브랜치 `master`를 향한다. 제목은 영어 Conventional Commits 제목, 본문은 한국어다. 머지는 merge commit으로 한다(`gh pr merge --merge`).

## 후속 이슈

작업하다 찾은 후속 작업은 GitHub 이슈로 만들어 그 작업이 속한 spec 이슈(지금은 #1)의 sub-issue로 잇고, [triage 라벨](triage-labels.md)을 하나 붙인다(바로 맡길 수 있을 만큼 적었으면 `ready-for-agent`). 명령은 [issue-tracker.md](issue-tracker.md)에 있다.
