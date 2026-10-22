import { notFound } from 'next/navigation'
import { connection } from 'next/server'

// 하네스(harness/app-boundaries.test.ts)의 탐침 페이지(server Starter). 요청마다 서버에서 렌더링하며, 백엔드에서 데이터를 찾지
// 못한 것을 흉내 내 잠시 기다린 뒤 notFound()를 부른다. 이 라우트에는 not-found.tsx가 없으므로 앱의 404 화면
// (src/app/not-found.tsx)이 받는다.
export default async function HarnessNotFoundPage(): Promise<never> {
  await connection()
  await new Promise((resolve) => setTimeout(resolve, 300))
  notFound()
}
