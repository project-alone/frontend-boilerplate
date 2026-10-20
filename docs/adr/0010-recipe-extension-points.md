# 여러 Recipe가 함께 끼어드는 Base 파일은 패치 대신 확장 지점에 조각을 더해 조립한다

모든 Recipe를 켜는 Showcase에서는 여러 Recipe가 Base의 같은 파일, 같은 자리를 고친다. 루트 레이아웃의 Provider, Next.js proxy, `next.config`, instrumentation, OpenAPI 명세, 환경 변수 파일이 그렇다. ADR-0007의 줄 단위 패치로는 이 자리에서 Recipe끼리 맥락 줄이 어긋나 함께 켤 수 없으므로, 이런 자리는 확장 지점으로 만들어 각 Recipe가 자기 조각만 더하고 Generator가 모든 overlay를 덧입힌 뒤 한꺼번에 조립한다. 확장 지점은 남은 Recipe(#16~#27) 가운데 둘 이상이 쓸 자리만 둔다.

- **TypeScript 조립 파일**(Provider와 머리글, proxy 처리기, `next.config` 래퍼, 서버·브라우저 instrumentation): overlay 최상위의 `extensions.json`에 지점마다 `{ path, export, order }`(Starter의 모듈, 내보내는 이름, 순서)를 적는다. Generator는 Base(`base/extensions.json`), Rendering Mode, Recipe의 선언을 `order` 순으로 모아 지점마다 조립 파일 하나(`src/app/app-shell.tsx`, `src/proxy.ts`, `next.config.plugins.ts`, `src/instrumentation.ts`, `src/instrumentation-client.ts`)를 쓴다. 조립 파일은 조각을 이름으로 import해 쓰므로 조각의 모양은 Starter의 타입 검사가 확인한다.
- **구조적 병합**: overlay의 `openapi.yaml`은 Base 명세를 대신하지 않고 명세 조각으로서 `paths`, `components`, `tags`가 병합된다. 경로, 컴포넌트 이름, tag, operationId가 겹치면 무엇을 쓰기 전에 실패한다. 병합한 명세로 재생성 API 계층(ADR-0003)도 다시 만든다. dotenv 파일(`.env`, `.env.<이름>`)은 변수 단위로 병합하고, 같은 파일의 같은 변수에 다른 값을 적으면 무엇을 쓰기 전에 실패한다.

## Considered Options

- **패치를 그대로 쓰고 맥락 줄을 줄인다**(ADR-0007): Recipe 하나씩은 동작하지만 같은 줄 근처를 고치는 Recipe 둘을 함께 켜면 어긋나고, 어느 Recipe가 먼저 오느냐에 따라 패치를 다시 만들어야 한다.
- **조립 파일을 Base에 두고 패치 없이 목록 파일만 생성한다**: Base Starter에 빈 목록 파일이 여러 개 생기고, proxy·instrumentation-client처럼 있으면 동작이 달라지는 Next.js 파일(proxy는 static-export 빌드를 막는다)은 Base에 둘 수 없다.
- **파일 이름 규칙으로 찾는다**(예: `*.provider.tsx`를 모두 감싼다): 선언이 필요 없지만 순서를 정할 곳이 없고, 번들러(Turbopack)에 glob import가 없어 실행할 때 찾을 수도 없다.
- **명세 조각과 함께 Recipe가 재생성 계층을 직접 담는다**: Generator가 orval을 담지 않아도 되지만, Recipe 작성자가 생성 결과를 손으로 맞춰 담아야 하고 Base tag에 operation을 더하는 Recipe끼리는 같은 생성 파일을 고쳐 부딪친다.

## Consequences

- Base도 같은 형식으로 자기 조각(QueryProvider, ToastProvider, MSW·백엔드 주소를 다루는 서버 instrumentation)을 선언하므로 Base의 조립 파일은 `base/`에 없고 Generator가 만든다. Base의 조각을 바꾸려면 `base/extensions.json`과 그 모듈을 고친다.
- 조립 파일은 모든 overlay를 덧입힌 뒤에 쓰므로 overlay의 패치로 고칠 수 없다. 조립 파일의 모양(머리글의 클래스, proxy의 matcher 등)은 Generator 코드(`src/extensions.ts`)가 정한다.
- Generator는 명세를 병합하고 재생성 계층을 다시 만들려고 Base가 고정한 orval, Prettier와 같은 버전을 의존성으로 고정한다. Base의 버전을 올리면 Generator의 버전도 함께 올린다. Starter에서는 같은 버전이 하나로 설치되므로 설치 크기는 늘지 않는다.
- proxy는 요청을 받는 서버가 있는 `server` Starter에만 만든다. `static-export`를 지원하는 Recipe의 proxy 처리기는 그 Rendering Mode에서 쓰이지 않으므로, 처리기 없이도 동작해야 한다.
- ADR-0007의 패치는 확장 지점이 없는 Base 파일(`.storybook/preview.tsx`, `vitest.config.ts`, 스타일 등)에 그대로 쓴다. 둘 이상의 Recipe가 같은 자리를 고치게 되면 그때 확장 지점을 더한다.
