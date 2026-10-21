---
"devc-frontend-generator": minor
---

목 백엔드(MSW)를 앱과 다른 출처 `https://mock.api.test`(`MOCK_API_BASE_URL`)에 둔다. 명세에서 생성한 MSW 핸들러(`orval.config.ts`의 `baseUrl`)와 Recipe의 핸들러는 이 주소로 가는 요청만 받고, Base의 `pageNavigationHandlers`가 페이지 탐색 요청을 목 응답 없이 그대로 보내므로, `static-export`에서 서비스 워커가 켜진 뒤 `/products`나 `/members` 같은 페이지를 직접 열거나 새로 고쳐도 목 응답(JSON) 대신 페이지가 열린다. MSW를 켜 둬도 `API_BASE_URL`(`NEXT_PUBLIC_API_BASE_URL`)을 넣으면 그 백엔드를 부르고, Vitest에서는 브라우저 코드의 요청도 목 백엔드로 보낸다.
