// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/optimistic-update/src/shared/mocks/todos.ts

import { delay, http, HttpResponse } from 'msw'
import { type Todo, TodoUpdate } from '@/shared/api/generated/model'
import { getListTodosResponseMock } from '@/shared/api/generated/todos/todos.msw'

// optimistic-update Recipe: 할 일(todos)을 흉내 내는 MSW 핸들러. 명세에서 생성한 핸들러는 example을 그대로 돌려주므로
// 완료 여부를 바꿔도 다시 가져온 목록은 그대로다. 이 핸들러가 그보다 앞에서(handlers.ts) 바뀐 완료 여부를 기억해
// 백엔드처럼 돌려준다. Vitest, 개발 서버, E2E가 모두 이 핸들러를 쓴다.
//
// - 저장(updateTodo)은 SAVE_DELAY_MS 뒤에 답한다. 응답이 늦어야 낙관적 업데이트가 응답 전에 화면을 바꾸고, 실패하면
//   되돌리는 것이 눈에 보인다.
// - REJECTED_TODO_ID의 할 일은 바꿀 권한이 없다며 늘 403으로 거절한다. 개발 서버와 E2E가 같은 할 일로 실패와 되돌리기를
//   재현한다.
// - 처음 할 일은 명세의 example이다. 바뀐 값은 MSW가 도는 곳의 메모리에만 있어, server에서는 Next.js 서버를 다시 띄울 때,
//   static-export에서는 브라우저가 페이지를 새로 불러올 때 처음으로 돌아간다.

/** 저장 요청에 답하기까지 걸리는 시간(ms) */
const SAVE_DELAY_MS = 1000

/** 목 백엔드가 바꿀 권한이 없다며 거절하는 할 일(명세 example의 4번) */
const REJECTED_TODO_ID = 4

let todos: Todo[] = getListTodosResponseMock()

export const todosHandlers = [
  http.get('*/todos', () => HttpResponse.json(todos)),
  http.patch<{ todoId: string }>('*/todos/:todoId', async ({ params, request }) => {
    await delay(SAVE_DELAY_MS)
    const todo = todos.find(({ id }) => String(id) === params.todoId)
    if (todo === undefined) return HttpResponse.json({ message: '할 일이 없습니다.' }, { status: 404 })
    if (todo.id === REJECTED_TODO_ID) {
      return HttpResponse.json({ message: '보안 점검 결과는 보안 담당자만 승인할 수 있습니다.' }, { status: 403 })
    }
    // 실제 백엔드처럼 명세에 맞지 않는 요청 본문은 400으로 거절한다.
    const update = TodoUpdate.safeParse(await request.json())
    if (!update.success) return HttpResponse.json({ message: update.error.message }, { status: 400 })
    const updated = { ...todo, ...update.data }
    todos = todos.map((current) => (current.id === updated.id ? updated : current))
    return HttpResponse.json(updated)
  }),
]
