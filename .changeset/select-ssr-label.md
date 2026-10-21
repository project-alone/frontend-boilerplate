---
"devc-frontend-generator": patch
---

Base `Select`의 선택 버튼이 서버가 그린 HTML에서도 레이블로 접근 가능한 이름을 갖는다. Base UI는 hydration 뒤에야 버튼을 레이블에 이어, 페이지를 연 직후에는 i18n의 locale 전환 UI 같은 선택 버튼에 이름이 없었다. i18n의 E2E가 스크립트를 막은 화면(hydration 전)에서 머리글을 axe로 검사한다.
