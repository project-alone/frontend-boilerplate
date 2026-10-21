## 낙관적 업데이트

`optimistic-update` Recipe로 넣었습니다. `/todos` 페이지의 할 일 목록에서 완료 여부를 바꾸면 서버의 응답을 기다리지 않고 바로 보여 주고(낙관적 업데이트), 서버가 거절하면 이전 상태로 되돌린 뒤 알림(Toast)으로 무엇을 왜 되돌렸는지 알립니다.

- 명세: `openapi.yaml`의 `listTodos`(`GET /todos`)가 할 일 목록을, `updateTodo`(`PATCH /todos/{todoId}`, 본문 `TodoUpdate`의 `done`)가 할 일 하나의 완료 여부를 바꿉니다(tag `todos`). 거절할 때는 이유를 `TodoError`(`message`)로 알립니다.
- Query Domain: `src/queries/todos/`는 `npm run g -- query listTodos`와 `npm run g -- mutation updateTodo --optimistic listTodos`가 만든 코드에, 응답 전에 보일 값을 만드는 `applyUpdateTodo`만 채운 것입니다. `useUpdateTodoMutation`은 `onMutate`에서 진행 중인 목록 요청을 취소하고 지금 값을 남긴 뒤 `applyUpdateTodo`로 목록 쿼리의 캐시를 고치고, `onError`에서 남긴 값으로 되돌리고, `onSettled`에서 `todosKeys.all`을 무효화해 서버의 값으로 맞춥니다. 다른 뮤테이션에 쓰려면 같은 명령으로 뼈대를 만들고 `apply<OperationId>`를 채웁니다.
- 화면: `src/features/todo-list/todo-list.tsx`. 할 일마다 뮤테이션 훅을 따로 써서, 저장하는 동안 그 할 일에 "저장 중"을 붙입니다(`aria-busy`). 실패하면 `mutate`의 `onError`에서 `useToast()`로 알립니다. 캐시를 되돌리는 일은 Query Domain이, 알리는 일은 화면이 맡습니다. 뮤테이션은 목록을 다시 가져온 뒤에 끝나므로 "저장 중"과 알림도 그때 바뀝니다. 끝낸 개수는 상태 문구(`role="status"`)로 알립니다.
- Rendering Mode: 두 Rendering Mode 모두 페이지 뼈대만 미리 만들고, 할 일은 브라우저가 가져와 고칩니다(`server`는 BFF 프록시, `static-export`는 백엔드 주소로 직접).
- MSW: `src/shared/mocks/todos.ts`의 핸들러가 바뀐 완료 여부를 기억해 돌려줍니다(처음 값은 명세의 `example`). 저장에는 1초 뒤에 답하고, 보안 점검 할 일(4번)은 바꿀 권한이 없다며 늘 403으로 거절합니다. 그래서 개발 서버에서도 응답 전에 바뀌는 모습과 되돌리기를 눈으로 볼 수 있고, E2E가 테스트만을 위한 코드 없이 실패를 재현합니다. `src/shared/mocks/handlers.ts`에서 생성된 핸들러보다 앞에 둡니다. 바뀐 값은 메모리에만 있어 `server`에서는 서버를 다시 띄울 때, `static-export`에서는 페이지를 새로 불러올 때 처음으로 돌아갑니다. 실제 백엔드로 바꾸면 이 파일과 `handlers.ts`의 `todosHandlers`를 지웁니다.
- 테스트: `src/features/todo-list/todo-list.test.tsx`(응답 전에 화면이 바뀌고 응답 뒤 서버의 값으로 맞춤, 거절하면 목록을 다시 가져오기 전에 되돌리고 알림, 이유 없는 실패, 목록을 못 불러옴), `e2e/optimistic-update.spec.ts`(빌드한 앱에서 응답 전에 바뀜, 거절된 할 일의 되돌리기와 알림, 키보드 조작, 접근성).
- 샘플을 지우려면 `src/app/todos/`, `src/features/todo-list/`, `src/queries/todos/`, `src/shared/mocks/todos.ts`(와 `handlers.ts`의 `todosHandlers`), `e2e/optimistic-update.spec.ts`를 지우고 `openapi.yaml`에서 `listTodos`, `updateTodo`를 뺀 뒤 `npm run api:gen`을 실행합니다.
