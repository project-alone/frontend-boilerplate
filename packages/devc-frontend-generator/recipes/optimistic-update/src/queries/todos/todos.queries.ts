import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { listTodos, updateTodo } from '@/shared/api/generated'
import { todosKeys } from './todos.keys'
import type { TodoUpdate, Todo } from '@/shared/api/generated/model'

// todos Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function listTodosQueryOptions() {
  return queryOptions({
    queryKey: todosKeys.listTodos(),
    queryFn: ({ signal }) => listTodos({ signal }),
  })
}

// updateTodo의 응답이 오기 전에 listTodos 쿼리에 보일 값(낙관적 업데이트). 보낸 값으로 응답 뒤의 값을 짐작해 돌려주도록 고친다.
// optimistic-update Recipe: updateTodo는 보낸 항목만 바꾸므로(명세), 목록에서 그 할 일에 보낸 값을 덮어쓴 것이 응답 뒤의 목록이다.
const applyUpdateTodo: (current: Todo[], variables: { todoId: number; todoUpdate: TodoUpdate }) => Todo[] = (
  current,
  { todoId, todoUpdate },
) => current.map((todo) => (todo.id === todoId ? { ...todo, ...todoUpdate } : todo))

export function useUpdateTodoMutation() {
  const queryClient = useQueryClient()
  // 응답 전에 고칠 listTodos 쿼리.
  const { queryKey } = listTodosQueryOptions()
  return useMutation({
    mutationFn: ({ todoId, todoUpdate }: { todoId: number; todoUpdate: TodoUpdate }) => updateTodo(todoId, todoUpdate),
    onMutate: async (variables) => {
      // 진행 중인 listTodos 요청의 응답이 고친 값을 덮어쓰지 않도록 취소하고, 되돌릴 값을 남긴다.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (current) =>
        current === undefined ? undefined : applyUpdateTodo(current, variables),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    // 성공하든 실패하든 todos Query Domain의 쿼리를 모두 무효화해 서버의 값으로 맞춘다.
    onSettled: () => queryClient.invalidateQueries({ queryKey: todosKeys.all }),
  })
}
