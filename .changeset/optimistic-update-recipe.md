---
"devc-frontend-generator": minor
---

`optimistic-update` Recipe를 더한다(`dcgen new --recipe optimistic-update`, `server`와 `static-export`). `/todos` 할 일 목록에서 완료 여부를 바꾸면 서버의 응답 전에 화면을 바꾸고(낙관적 업데이트), 서버가 거절하면 이전 상태로 되돌린 뒤 공통 Toast로 무엇을 왜 되돌렸는지 알린다. 명세 조각으로 `listTodos`, `updateTodo`(tag `todos`)를 더하고, Query Domain(`src/queries/todos`)은 `npm run g -- mutation updateTodo --optimistic listTodos`가 만든 뼈대에 응답 전에 보일 값(`applyUpdateTodo`)만 채운다. 바뀐 값을 기억하고 저장에 늦게 답하며 정해 둔 할 일 하나를 늘 거절하는 MSW 핸들러, 응답 전의 캐시와 되돌리기를 보는 컴포넌트 테스트, 실패를 MSW로 재현해 되돌리기와 알림·접근성을 보는 E2E가 함께 들어간다.
