---
"devc-frontend-generator": minor
---

`table` Recipe를 더한다(`dcgen new --recipe table`, `server`와 `static-export`). TanStack Table로 만든 `/members` 회원 목록 테이블이 열 머리글로 정렬하고 검색어와 역할로 거르고 페이지를 넘기며, 정렬·필터·페이지는 백엔드가 처리한다. 명세 조각으로 정렬·필터·페이지 파라미터를 받는 `listMembers`(tag `members`)를 더하고, 테이블의 상태는 `npm run g -- query listMembers`로 만든 Query Domain(`src/queries/members`)의 쿼리 키와 요청 파라미터에 함께 담긴다. 파라미터대로 거르고 정렬하는 MSW 핸들러, 컴포넌트 테스트, 키보드 조작과 접근성을 보는 E2E가 함께 들어간다.
