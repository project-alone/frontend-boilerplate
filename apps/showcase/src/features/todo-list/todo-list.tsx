// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/optimistic-update/src/features/todo-list/todo-list.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import { listTodosQueryOptions, useUpdateTodoMutation } from '@/queries/todos/todos.queries'
import { ApiError } from '@/shared/api/api-fetch'
import { type Todo, TodoError } from '@/shared/api/generated/model'
import { Checkbox } from '@/shared/ui/checkbox'
import { Field, FieldLabel } from '@/shared/ui/field'
import { useToast } from '@/shared/ui/toast'

// optimistic-update Recipe: 할 일 목록(listTodos). 완료 여부를 바꾸면 Query Domain의 뮤테이션 훅(useUpdateTodoMutation)이
// 응답을 기다리지 않고 목록 쿼리의 캐시를 먼저 고치므로(낙관적 업데이트) 화면이 바로 바뀐다. 서버가 거절하면 훅이 캐시를
// 뮤테이션 전의 값으로 되돌리고, 이 Feature가 알림(Toast)으로 무엇을 왜 되돌렸는지 알린다. 성공하든 실패하든 끝나면 훅이
// 목록을 다시 가져와 서버의 값으로 맞춘다. 캐시를 고치고 되돌리는 판단은 Query Domain이, 알리는 일은 화면이 맡는다.

/** 실패한 이유. 서버가 명세의 TodoError로 이유를 알리지 않았으면(네트워크 오류 등) 다시 시도하라고 안내한다. */
function failureReason(error: Error): string {
  const body = error instanceof ApiError ? TodoError.safeParse(error.body).data : undefined
  return body?.message ?? '잠시 뒤에 다시 시도해 주세요.'
}

/** 할 일이 몇 개이고 그 가운데 몇 개를 끝냈는지 알린다. */
function doneSummary(todos: readonly Todo[]): string {
  if (todos.length === 0) return '할 일이 없습니다.'
  const done = todos.filter((todo) => todo.done).length
  return `할 일 ${String(todos.length)}개 중 ${String(done)}개를 끝냈습니다.`
}

/**
 * 할 일 목록. 체크박스(Space, 클릭)로 완료 여부를 바꾸면 바로 보여 주고, 저장하는 동안 그 할 일에 "저장 중"을 붙인다.
 * 끝낸 개수는 상태 문구(role="status")로 알린다.
 */
export function TodoList() {
  const { data, isError } = useQuery(listTodosQueryOptions())

  return (
    <div className="flex flex-col gap-4">
      <p role="status">{data === undefined ? (isError ? '' : '할 일을 불러오는 중입니다.') : doneSummary(data)}</p>
      {data === undefined && isError && <p role="alert">할 일을 불러오지 못했습니다.</p>}
      {data !== undefined && (
        <ul aria-label="할 일 목록" className="flex flex-col gap-2">
          {data.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** 할 일 하나. 항목마다 뮤테이션 훅을 따로 써서, 여러 할 일을 잇달아 바꿔도 저장 중인지를 할 일마다 보여 준다. */
function TodoItem({ todo }: Readonly<{ todo: Todo }>) {
  const toast = useToast()
  const { mutate, isPending } = useUpdateTodoMutation()

  return (
    <li aria-busy={isPending} className="flex items-center gap-3">
      <Field>
        <FieldLabel>
          <Checkbox
            checked={todo.done}
            onCheckedChange={(done) => {
              mutate(
                { todoId: todo.id, todoUpdate: { done } },
                {
                  // 캐시는 뮤테이션 훅이 이미 되돌렸다. 화면은 무엇이 왜 되돌아갔는지 알리기만 한다.
                  onError: (error) => {
                    toast.add({
                      type: 'error',
                      title: '할 일을 바꾸지 못해 되돌렸습니다',
                      description: `${todo.title}: ${failureReason(error)}`,
                    })
                  },
                },
              )
            }}
          />
          {todo.title}
        </FieldLabel>
      </Field>
      {isPending && <span className="text-sm text-muted-foreground">저장 중</span>}
    </li>
  )
}
