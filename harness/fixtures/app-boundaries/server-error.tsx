import { cookies } from 'next/headers'

// 하네스(harness/app-boundaries.test.ts)의 탐침 페이지(server Starter). harness-fail 쿠키가 있으면 서버에서 렌더링하다 오류를
// 던진다. 쿠키를 지운 뒤 다시 시도하면 서버에서 다시 렌더링해 페이지를 보여 준다.
export default async function HarnessServerErrorPage() {
  if ((await cookies()).has('harness-fail')) throw new Error('harness-server-error')

  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">서버 오류 탐침</h1>
    </main>
  )
}
