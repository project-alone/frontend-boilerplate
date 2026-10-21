---
"devc-frontend-generator": minor
---

Base에 `waitForMocks()`(`src/shared/mocks/mock-readiness.ts`)를 더한다. 브라우저의 MSW(`static-export`의 서비스 워커)가 요청을 받을 준비가 되면 끝나고, 목을 끈 빌드와 `server`에서는 바로 끝난다. fetch처럼 붙잡아 둘 수 없는 요청을 보내는 file-upload의 `apiUpload`(XMLHttpRequest)와 realtime의 이벤트 스트림이 이를 기다린 뒤 보내므로, 페이지를 열자마자 보낸 첫 요청도 목을 거치지 않고 나가지 않는다.
