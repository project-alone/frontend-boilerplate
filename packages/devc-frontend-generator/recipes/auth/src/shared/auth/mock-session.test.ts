import { expect, onTestFinished, test } from 'vitest'
import { getMe } from '@/shared/api/generated'
import { signInAsMockUser } from './mock-session'

// 요청은 Vitest의 MSW(@/shared/mocks/node)가 받고, auth의 목 백엔드(auth-mock-handlers.ts)가 발급한 accessToken으로 사용자를 답한다.
// 브라우저 코드(jsdom)의 요청은 BFF 프록시 없이 목 백엔드로 바로 간다(vitest.setup.ts).

test('목 사용자로 로그인하면 브라우저 코드의 요청에 그 사용자의 accessToken이 붙어, 목 백엔드가 그 사용자로 답한다', async () => {
  onTestFinished(signInAsMockUser('admin@example.com'))

  await expect(getMe()).resolves.toMatchObject({ email: 'admin@example.com', roles: ['admin', 'user'] })
})

test('로그인하지 않은 요청과 되돌린 뒤의 요청에는 accessToken이 없어 목 백엔드가 401로 답한다', async () => {
  await expect(getMe()).rejects.toMatchObject({ name: 'ApiError', status: 401 })

  const signOut = signInAsMockUser('user@example.com')
  await expect(getMe()).resolves.toMatchObject({ email: 'user@example.com' })
  signOut()

  await expect(getMe()).rejects.toMatchObject({ status: 401 })
})
