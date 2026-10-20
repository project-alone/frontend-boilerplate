# Rendering Mode와 Recipe는 같은 overlay로 Base에 덧입히고, Base 파일은 패치로 고친다

Starter는 Base를 복사한 뒤 Rendering Mode(`rendering-modes/<mode>/`)와 Recipe(`recipes/<name>/`)를 같은 형식의 overlay, 곧 파일 추가·교체, `package.json` 병합, README 절 병합, 지울 경로 목록(`remove.txt`), 기존 파일을 고치는 unified diff(`<경로>.patch`)로 덧입혀 만든다. Base 파일의 일부만 바꿀 때는 파일을 통째로 복사하지 않고 패치를 쓴다(static-export의 `.gitlab-ci.yml`, `playwright.config.ts`도 패치다). 복사한 사본은 Base가 그 파일을 고쳐도 따라가지 않아 조용히 어긋나고, 같은 파일을 바꾸는 overlay끼리 서로 덮어쓰기 때문이다.

## Considered Options

- **파일 통째로 교체**: 단순하지만 Base와의 차이가 사본 안에 숨어 쌓이고, 같은 파일을 바꾸는 Recipe 둘을 함께 쓸 수 없다. 내용이 Base와 전혀 다른 파일(예: static-export의 `e2e/products.spec.ts`)에만 쓴다.
- **파일 종류별 구조적 편집(AST, YAML 편집기)**: 맥락이 조금 바뀌어도 적용되지만 파일 종류마다 편집기가 필요하고 Recipe 작성자가 편집 API를 익혀야 한다. 형식이 단순하고 여러 overlay가 자주 함께 고치는 `package.json`과 README에만 병합 규칙을 둔다.
- **Rendering Mode와 Recipe가 조립 방식을 따로 가짐**(Recipe 전의 Rendering Mode 적용 코드): 기여자가 두 형식을 익혀야 하고, 패치 같은 기능이 한쪽에만 생긴다.

## Consequences

- Base나 먼저 덧입힌 overlay가 패치의 맥락 줄을 바꾸면 패치가 적용되지 않고, `dcgen new`는 어느 패치인지 알리며 실패한다. 조용히 어긋나는 대신 시끄럽게 깨지는 쪽을 고른 것이며, 하네스의 조합 매트릭스(Rendering Mode × Recipe)가 머지 전에 잡는다. 기여자는 패치를 다시 만든다(`docs/recipes.md`).
- 결과는 덧입히는 순서(Base → Rendering Mode → 필요한 Recipe가 먼저 오고 나머지는 이름순인 Recipe)에 따라 정해진다. 패치는 그 시점의 파일에 적용되므로 맥락 줄을 꼭 필요한 만큼만 둔다.
