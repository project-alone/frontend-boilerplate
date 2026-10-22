// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/mocks/node.test.ts

// @vitest-environment node
import { delay, http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { server } from './node'

// 이 파일은 서버(Next.js 서버, Vitest)처럼 Node.js에서 실행된다.

test('목 백엔드로 보낸 요청이 끝나기 전에 다른 WebCrypto AES 작업이 끝나도 프로세스가 죽지 않는다', async () => {
  // 목 서버를 켠 서버에서 auth Recipe가 세션 쿠키를 AES로 암호화·복호화하는 동안, 다른 요청은 목 백엔드의 응답을 기다린다(#82).
  const key = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-CBC', false, ['encrypt'])
  const encrypted: Promise<ArrayBuffer>[] = []
  server.use(
    http.get(`${MOCK_API_BASE_URL}/harness-slow`, async () => {
      encrypted.push(crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, key, new Uint8Array(16)))
      await delay(20)
      return HttpResponse.json({})
    }),
  )

  // 요청마다 목 백엔드와 새 연결을 연다. 두 번째 요청부터는 앞 연결의 TLS 세션을 다시 쓰려 한다.
  for (let i = 0; i < 3; i++) await (await fetch(`${MOCK_API_BASE_URL}/harness-slow`)).json()

  expect(await Promise.all(encrypted)).toHaveLength(3)
})
