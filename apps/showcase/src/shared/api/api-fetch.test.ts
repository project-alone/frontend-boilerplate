// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/api/api-fetch.test.ts

import { http, HttpResponse, type JsonBodyType } from 'msw'
import { afterEach, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { server } from '@/shared/mocks/node'
import { ApiError, apiFetch } from './api-fetch'

// 이 파일은 브라우저(jsdom)에서 실행된다. 서버에서의 동작은 api-fetch.server.test.ts가 확인한다.

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

test('브라우저에서는 BFF 프록시(/api/proxy)를 거쳐 요청한다', async () => {
  // 테스트는 브라우저의 요청도 목 백엔드로 보내므로(vitest.setup.ts) 기본값인 BFF 프록시를 보려고 비운다.
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
  const urls = respondToAll([])

  await apiFetch('/products?q=셔츠')

  expect(urls).toEqual([new URL('/api/proxy/products?q=셔츠', location.origin).href])
})

test('NEXT_PUBLIC_API_BASE_URL을 넣으면 브라우저가 백엔드를 직접 부른다(서버가 없는 static-export용)', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://backend.example.com/')
  const urls = respondToAll([])

  await apiFetch('/products')

  expect(urls).toEqual(['https://backend.example.com/products'])
})

test('응답이 명세의 Zod 스키마와 다르면 실패한다', async () => {
  respondToAll({ id: '1' })

  await expect(apiFetch('/products/1', { schema: z.object({ id: z.number() }) })).rejects.toThrow(z.ZodError)
})

test('백엔드가 2xx가 아닌 응답을 주면 상태와 본문을 담은 ApiError로 실패한다', async () => {
  respondToAll({ message: '없는 상품입니다' }, 404)

  const error: unknown = await apiFetch('/products/404').catch((caught: unknown) => caught)

  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ status: 404, body: { message: '없는 상품입니다' } })
})
