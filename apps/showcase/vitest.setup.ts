// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/vitest.setup.ts

import '@testing-library/jest-dom/vitest'
import dns from 'node:dns'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { server } from '@/shared/mocks/node'

// 브라우저 코드(jsdom)의 API 요청도 목 백엔드 주소로 보내 MSW가 받게 한다. Rendering Mode server의 브라우저는 BFF 프록시
// (/api/proxy)를 부르는데, 테스트에는 그 요청을 받을 Next.js 서버가 없다. vi.stubEnv로 넣으면 테스트의 vi.unstubAllEnvs()가
// 지우므로 process.env에 직접 넣는다(process-env.d.ts가 읽기 전용으로 선언해 Object.assign으로 쓴다). 테스트에서 다른 주소가
// 필요하면 vi.stubEnv로 바꾼다.
Object.assign(process.env, { NEXT_PUBLIC_API_BASE_URL: MOCK_API_BASE_URL })

// 목 백엔드 주소(MOCK_API_BASE_URL)의 DNS 조회는 운영체제에 묻지 않고 바로 실패시킨다. MSW는 요청을 하나도 보내지 않은 연결을
// 실제 네트워크로 내보내는데, 보내던 요청을 취소하면 jsdom의 XMLHttpRequest와 Node.js의 fetch가 쓰는 undici가 요청 없이 그런
// 연결을 새로 연다. 그 연결은 목 백엔드 주소의 DNS 조회가 실패해야 끊기므로, 조회를 기다리는 사이에 같은 연결로 보낸 다음 요청은
// MSW가 답하고 있어도 네트워크 오류로 실패한다(예: 올리던 파일을 취소하고 다시 올리기). 바로 실패시키면 그 연결은 다음 요청을
// 받기 전에 끊긴다. MSW가 받는 연결은 DNS를 거치지 않으므로 영향이 없다.
const mockApiHost = new URL(MOCK_API_BASE_URL).hostname
const systemLookup = dns.lookup

function lookupWithoutMockApi(hostname: string, ...rest: unknown[]): void {
  const callback = rest.at(-1)
  if (hostname !== mockApiHost || typeof callback !== 'function') {
    Reflect.apply(systemLookup, dns, [hostname, ...rest])
    return
  }
  const notFound = Object.assign(new Error(`getaddrinfo ${dns.NOTFOUND} ${hostname}`), {
    code: dns.NOTFOUND,
    syscall: 'getaddrinfo',
    hostname,
  })
  process.nextTick(callback, notFound)
}

// 핸들러가 없는 요청은 실제 네트워크로 나가지 않고 테스트를 실패시킨다. DNS 조회는 테스트 파일마다 바꾸고 되돌린다.
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
  Object.assign(dns, { lookup: lookupWithoutMockApi })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
  Object.assign(dns, { lookup: systemLookup })
})
