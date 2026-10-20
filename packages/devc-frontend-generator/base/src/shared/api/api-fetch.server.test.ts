// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { afterEach, expect, test, vi } from 'vitest'
import { server } from '@/shared/mocks/node'
import { apiFetch } from './api-fetch'

// 이 파일은 서버(서버 컴포넌트, Route Handler)처럼 window가 없는 Node.js에서 실행된다.

afterEach(() => {
  vi.unstubAllEnvs()
})

test('서버에서는 API_BASE_URL의 백엔드를 직접 부른다', async () => {
  vi.stubEnv('API_BASE_URL', 'https://backend.example.com/')
  const urls: string[] = []
  server.use(
    http.all('*', ({ request }) => {
      urls.push(request.url)
      return HttpResponse.json([])
    }),
  )

  await apiFetch('/products?q=셔츠')

  expect(urls).toEqual([new URL('https://backend.example.com/products?q=셔츠').href])
})

test('서버에서 API_BASE_URL이 없으면 무엇을 넣어야 하는지 알려 주며 실패한다', async () => {
  vi.stubEnv('API_BASE_URL', '')

  await expect(apiFetch('/products')).rejects.toThrow('API_BASE_URL')
})
