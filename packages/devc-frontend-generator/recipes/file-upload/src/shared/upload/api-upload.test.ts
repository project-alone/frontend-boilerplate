import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { z } from 'zod'
import { ApiError, apiFetch } from '@/shared/api/api-fetch'
import { getUploadFileUrl } from '@/shared/api/generated'
import { UploadedFile } from '@/shared/api/generated/model'
import { setMockReadiness } from '@/shared/mocks/mock-readiness'
import { server } from '@/shared/mocks/node'
import { apiUpload, type UploadProgress } from './api-upload'

// 이 파일은 브라우저(jsdom)에서 실행된다. 요청은 Vitest의 MSW(@/shared/mocks/node)가 받고, 업로드(POST /files)에는
// file-upload Recipe의 핸들러(src/shared/mocks/files.ts)가 답한다.
// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로, 개발 서버와 E2E처럼 브라우저의 요청을 MSW가 받는
// 빌드를 흉내 낸다(server에서는 쓰이지 않는다).
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

/** 업로드 operation(POST)의 요청을 모은다. 다른 출처로 보낼 때 브라우저가 먼저 보내는 preflight(OPTIONS)는 뺀다. */
function recordUploadRequests(): Request[] {
  const requests: Request[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST') requests.push(request)
  })
  onTestFinished(() => {
    server.events.removeAllListeners()
  })
  return requests
}

function multipart(file: File): FormData {
  const body = new FormData()
  body.append('file', file)
  return body
}

const textFile = (name: string, content = '업로드할 내용') => new File([content], name, { type: 'text/plain' })

test('생성된 fetch 함수(apiFetch)와 같은 주소로 multipart 본문을 보내고, 응답을 명세의 스키마로 검증해 돌려준다', async () => {
  const requests = recordUploadRequests()
  // apiFetch가 이 operation을 보내는 주소(server는 BFF 프록시, static-export는 백엔드). 본문이 없어 거절되지만 주소만 본다.
  await apiFetch(getUploadFileUrl(), { method: 'POST' }).catch(() => undefined)

  const uploaded = await apiUpload(getUploadFileUrl(), {
    body: multipart(textFile('notes.txt', 'hello')),
    schema: UploadedFile,
  })

  expect(uploaded).toMatchObject({ name: 'notes.txt', size: 5, contentType: 'text/plain' })
  const [viaApiFetch, viaApiUpload] = requests
  expect(viaApiUpload?.url).toBe(viaApiFetch?.url)
  expect(viaApiUpload?.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/)
})

test('본문을 보내는 동안 보낸 바이트 수와 전체 바이트 수를 onProgress로 알린다', async () => {
  const progress: UploadProgress[] = []

  await apiUpload(getUploadFileUrl(), {
    body: multipart(textFile('progress.txt')),
    onProgress: (event) => progress.push(event),
  })

  const last = progress.at(-1)
  expect(last?.total).toBeGreaterThan(0)
  expect(last?.loaded).toBe(last?.total)
})

test('onProgress를 넘기지 않으면 upload 이벤트를 듣지 않아, 다른 출처의 백엔드(static-export)에도 preflight 없이 보낸다', async () => {
  const preflights: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'OPTIONS') preflights.push(request.url)
  })
  onTestFinished(() => {
    server.events.removeAllListeners()
  })

  await apiUpload(getUploadFileUrl(), { body: multipart(textFile('quiet.txt')) })

  expect(preflights).toEqual([])
})

test('백엔드가 2xx가 아닌 응답을 주면 상태와 본문을 담은 ApiError로 실패한다', async () => {
  const program = new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' })

  const error: unknown = await apiUpload(getUploadFileUrl(), { body: multipart(program) }).catch(
    (caught: unknown) => caught,
  )

  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ status: 415, body: { message: 'PNG, JPEG, PDF, 텍스트 파일만 올릴 수 있습니다.' } })
})

test('응답이 명세의 Zod 스키마와 다르면 실패한다', async () => {
  // 다른 출처(static-export의 백엔드)의 응답은 CORS 헤더가 있어야 브라우저가 읽는다.
  server.use(
    http.post('*/files', () =>
      HttpResponse.json({ id: 1 }, { status: 201, headers: { 'Access-Control-Allow-Origin': '*' } }),
    ),
  )

  await expect(
    apiUpload(getUploadFileUrl(), { body: multipart(textFile('broken.txt')), schema: UploadedFile }),
  ).rejects.toThrow(z.ZodError)
})

test('signal로 취소하면 응답을 기다리지 않고 AbortError로 실패한다', async () => {
  const requests = recordUploadRequests()
  const controller = new AbortController()
  // 이름에 slow가 든 파일은 목 백엔드가 늦게 답한다(src/shared/mocks/files.ts).
  const upload = apiUpload(getUploadFileUrl(), { body: multipart(textFile('slow.txt')), signal: controller.signal })
  await vi.waitFor(() => {
    expect(requests).toHaveLength(1)
  })

  controller.abort()

  await expect(upload).rejects.toMatchObject({ name: 'AbortError' })
})

test('이미 취소된 signal을 넘기면 요청을 보내지 않는다', async () => {
  const requests = recordUploadRequests()

  await expect(
    apiUpload(getUploadFileUrl(), { body: multipart(textFile('never.txt')), signal: AbortSignal.abort() }),
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(requests).toEqual([])
})

test('브라우저의 MSW가 요청을 받을 준비가 될 때까지 기다린 뒤 보낸다', async () => {
  const requests = recordUploadRequests()
  // static-export의 브라우저 MSW(서비스 워커)가 아직 준비되지 않은 페이지를 흉내 낸다(src/shared/mocks/mock-readiness.ts).
  const { promise: ready, resolve } = Promise.withResolvers<undefined>()
  setMockReadiness(ready)
  onTestFinished(() => {
    setMockReadiness(Promise.resolve())
  })

  const upload = apiUpload(getUploadFileUrl(), { body: multipart(textFile('early.txt')) })
  await new Promise((wait) => setTimeout(wait, 50))
  expect(requests).toEqual([])

  resolve(undefined)
  await expect(upload).resolves.toMatchObject({ name: 'early.txt' })
  expect(requests).toHaveLength(1)
})
