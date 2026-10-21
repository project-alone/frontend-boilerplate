import type { Metadata } from 'next'
import { TodoList } from '@/features/todo-list/todo-list'

export const metadata: Metadata = {
  title: '할 일',
}

// optimistic-update Recipe: 낙관적 업데이트와 실패 시 되돌리기를 보여 주는 할 일 목록. 페이지 뼈대는 빌드할 때 미리
// 만들고, 할 일은 브라우저가 가져와 고친다. 그래서 두 Rendering Mode에서 같은 코드로 동작한다(server는 BFF 프록시,
// static-export는 백엔드를 직접 부른다).
export default function TodosPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">할 일</h1>
      <p className="text-sm text-muted-foreground">
        완료 여부를 바꾸면 서버의 응답을 기다리지 않고 바로 보여 줍니다. 서버가 거절하면 원래대로 되돌리고 알림으로 알려
        줍니다.
      </p>
      <TodoList />
    </main>
  )
}
