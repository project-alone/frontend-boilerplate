import { http, HttpResponse, type JsonBodyType } from 'msw'
import { afterEach, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { server } from '@/shared/mocks/node'
import { ApiError, apiFetch } from './api-fetch'
import { MOCK_API_BASE_URL } from './base-url'

// 이 파일은 브라우저(jsdom)에서 실행된다. Rendering Mode static-export에는 BFF 프록시가 없으므로 브라우저가 백엔드를
// 직접 부른다. 서버에서의 동작은 api-fetch.server.test.ts가 확인한다.

afterEach(() => {
  vi.unstubAllEnvs()
})

/** 모든 요청에 body로 응답하고, 요청이 간 주소를 모은다. */
function respondToAll(body: JsonBodyType, status = 200): string[] {
  const urls: string[] = []
  server.use(
    http.all('*', ({ request }) => {
      urls.push(request.url)
      return HttpResponse.json(body, { status })
    }),
  )
  return urls
}

test('브라우저는 NEXT_PUBLIC_API_BASE_URL의 백엔드를 직접 부른다', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://backend.example.com/')
  const urls = respondToAll([])

  await apiFetch('/products?q=셔츠')

  expect(urls).toEqual([new URL('https://backend.example.com/products?q=셔츠').href])
})

test('브라우저의 MSW가 켜져 있으면 NEXT_PUBLIC_API_BASE_URL이 없어도 MSW가 받는 목 주소로 요청한다', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
  const urls = respondToAll([])

  await apiFetch('/products')

  expect(urls).toEqual([`${MOCK_API_BASE_URL}/products`])
})

test('브라우저의 MSW를 끄고 NEXT_PUBLIC_API_BASE_URL을 넣지 않았으면 무엇을 넣어야 하는지 알려 주며 실패한다', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'disabled')
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')

  await expect(apiFetch('/products')).rejects.toThrow('NEXT_PUBLIC_API_BASE_URL')
})

test('응답이 명세의 Zod 스키마와 다르면 실패한다', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://backend.example.com')
  respondToAll({ id: '1' })

  await expect(apiFetch('/products/1', { schema: z.object({ id: z.number() }) })).rejects.toThrow(z.ZodError)
})

test('백엔드가 2xx가 아닌 응답을 주면 상태와 본문을 담은 ApiError로 실패한다', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://backend.example.com')
  respondToAll({ message: '없는 상품입니다' }, 404)

  const error: unknown = await apiFetch('/products/404').catch((caught: unknown) => caught)

  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ status: 404, body: { message: '없는 상품입니다' } })
})
