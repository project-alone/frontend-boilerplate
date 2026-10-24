# Rendering Mode와 Recipe는 같은 overlay로 Base에 덧입히고, Base 파일은 패치로 고친다

Starter는 Base를 복사한 뒤 Rendering Mode(`rendering-modes/<mode>/`)와 Recipe(`recipes/<name>/`)를 같은 형식의 overlay, 곧 파일 추가·교체, `package.json` 병합, README 절 병합, 지울 경로 목록(`remove.txt`), 기존 파일을 고치는 unified diff(`<경로>.patch`)로 덧입혀 만든다. Base 파일의 일부만 바꿀 때는 파일을 통째로 복사하지 않고 패치를 쓴다(static-export의 `.gitlab-ci.yml`, `config/playwright.config.ts`도 패치다). 복사한 사본은 Base가 그 파일을 고쳐도 따라가지 않아 조용히 어긋나고, 같은 파일을 바꾸는 overlay끼리 서로 덮어쓰기 때문이다.

## Considered Options

- **파일 통째로 교체**: 단순하지만 Base와의 차이가 사본 안에 숨어 쌓이고, 같은 파일을 바꾸는 Recipe 둘을 함께 쓸 수 없다. 내용이 Base와 전혀 다른 파일에만 쓴다. static-export는 API 계층 샘플(API base URL 모듈, 상품 목록 페이지와 Feature, 그 테스트와 E2E)을 통째로 대신했다가, Base만 고쳐지고 사본은 그대로 남는 일이 생겨 모두 패치로 바꿨다(#94).
- **파일 종류별 구조적 편집(AST, YAML 편집기)**: 맥락이 조금 바뀌어도 적용되지만 파일 종류마다 편집기가 필요하고 Recipe 작성자가 편집 API를 익혀야 한다. 형식이 단순하고 여러 overlay가 자주 함께 고치는 `package.json`과 README에만 병합 규칙을 둔다.
- **Rendering Mode와 Recipe가 조립 방식을 따로 가짐**(Recipe 전의 Rendering Mode 적용 코드): 기여자가 두 형식을 익혀야 하고, 패치 같은 기능이 한쪽에만 생긴다.

## Consequences

- Base나 먼저 덧입힌 overlay가 패치의 맥락 줄을 바꾸면 패치가 적용되지 않고, `dcgen new`는 어느 패치인지 알리며 실패한다. 조용히 어긋나는 대신 시끄럽게 깨지는 쪽을 고른 것이며, 하네스의 조합 매트릭스(Rendering Mode × Recipe)가 머지 전에 잡는다. 기여자는 패치를 다시 만든다(`docs/recipes.md`).
- 결과는 덧입히는 순서(Base → Rendering Mode → 필요한 Recipe가 먼저 오고 나머지는 이름순인 Recipe → 이름순인 Archetype)에 따라 정해진다. 패치는 그 시점의 파일에 적용되므로 맥락 줄을 꼭 필요한 만큼만 둔다. Archetype(#28)은 같은 overlay 형식에 선언 파일(`archetype.json`)만 다르고, 자기가 쓰는 Recipe 뒤에 덧입혀 Recipe의 파일도 패치로 고칠 수 있다(`docs/archetypes.md`).
- 여러 Recipe가 함께 끼어드는 자리(루트 레이아웃의 Provider와 머리글, proxy, `next.config`, instrumentation, 서버가 백엔드로 보내는 요청, MSW 핸들러 목록, OpenAPI 명세, 환경 변수 파일)는 패치 대신 확장 지점에 조각을 더한다(ADR-0010). overlay 형식에는 확장 지점의 선언(`extensions.json`)과 명세 조각(`openapi.yaml`), dotenv 파일의 변수 단위 병합이 더해졌다.
