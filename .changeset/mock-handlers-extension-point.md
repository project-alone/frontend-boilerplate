---
"devc-frontend-generator": minor
---

Recipe가 직접 만든 MSW 핸들러를 더하는 확장 지점 `mockHandlers`를 더한다. Recipe는 `extensions.json`에 핸들러 배열을 `{ path, export, order }`로 선언하고, Generator가 MSW의 핸들러 목록 `src/shared/mocks/handlers.ts`를 Recipe의 핸들러(`order` 순) 뒤에 명세에서 생성한 핸들러를 붙여 조립한다. Recipe의 핸들러가 먼저 응답하므로 같은 요청의 생성된 핸들러를 덮어쓴다. 이 파일은 이제 Base 파일이 아니라 조립 파일이라 패치할 수 없다. `table` Recipe의 회원 목록 핸들러와 `auth` Recipe의 목 백엔드도 패치 대신 이 지점으로 옮겨, 두 Recipe를 함께 켤 수 있다.
