import { connection } from 'next/server'

// 하네스(harness/app-boundaries.test.ts)의 탐침 페이지(server Starter). 요청마다 서버에서 렌더링하고, 느린 백엔드를 흉내 내
// 2초 기다린다. 이 라우트에는 loading.tsx가 없으므로 기다리는 동안 앱 수준의 로딩 상태(src/app/loading.tsx)를 먼저 보낸다.
export default async function HarnessSlowPage() {
  await connection()
  await new Promise((resolve) => setTimeout(resolve, 2_000))

  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">느린 페이지 탐침</h1>
    </main>
  )
}
