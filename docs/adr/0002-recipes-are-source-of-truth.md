# Recipe가 원본이고, Starter와 Showcase는 Base에 Recipe를 덧붙여 생성한다

Starter, Showcase, Generator 세 쓰임새를 한 소스에서 유지하기 위해, 원본은 Base와 각 Recipe(파일·의존성·설정 패치·테스트를 가진 독립 단위)로 두고 Starter는 Base에 선택한 Recipe를 덧붙여 조립한다. Showcase는 "모든 Recipe를 켠"(Recipe를 조합한 Archetype도 모두 켠) 조립 결과물이므로 직접 고치지 않으며, CI에서 Recipe 조합을 빌드·테스트해 Recipe 간 충돌을 검증한다.

## Considered Options

- **Showcase가 원본, 선택되지 않은 부분을 제거(strip)해 Starter 생성**: 작성은 편하지만 마커 주석·codemod에 의존해 깨지기 쉽고, Recipe끼리 얽히면 떼어 내기 어렵다.

## Consequences

- Recipe를 작성할 때 바로 실행해 볼 수 있도록 Showcase를 watch 모드로 재생성하는 개발 스크립트가 필요하다.
