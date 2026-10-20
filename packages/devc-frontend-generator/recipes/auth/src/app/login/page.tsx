import type { Metadata } from 'next'
import { LoginForm } from '@/features/login-form/login-form'
import { returnPathOf } from '@/shared/auth/access-rules'

export const metadata: Metadata = {
  title: '로그인',
}

// auth Recipe: 보호된 라우트에 로그인하지 않고 들어오면 proxy가 돌아올 주소(next)를 담아 이 페이지로 보낸다.
export default async function LoginPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const { next } = await searchParams

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">로그인</h1>
      <LoginForm returnPath={returnPathOf(typeof next === 'string' ? next : undefined)} />
      {process.env.API_MOCKING === 'enabled' && (
        <p className="text-sm text-muted-foreground">
          목 백엔드의 계정: user@example.com(사용자), admin@example.com(관리자). 비밀번호는 모두 password입니다.
        </p>
      )}
    </main>
  )
}
