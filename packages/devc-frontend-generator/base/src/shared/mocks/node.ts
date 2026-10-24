import 'server-only'
import tls from 'node:tls'
import { setupServer } from 'msw/node'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { handlers } from './handlers'

// Node.js에서 나가는 요청을 가로챈다. Vitest와 Next.js 서버(개발 서버, E2E 대상 서버)가 쓴다.
export const server = setupServer(...handlers)

// 목 백엔드(MOCK_API_BASE_URL)와 여는 TLS 연결에는 앞 연결의 TLS 세션을 넘기지 않는다.
//
// MSW는 목 백엔드와의 TLS 연결을 흉내 내면서 가짜 TLS 세션을 내보내고, Node.js의 fetch(undici)는 그 세션을 기억했다가 같은
// 주소로 여는 다음 연결에 넘긴다. Node.js 24는 해석하지 못한 세션을 오류 없이 버리면서 OpenSSL의 오류만 남겨 두고, 그 오류가
// 남아 있는 사이에 WebCrypto의 AES 작업(auth Recipe가 세션 쿠키를 암호화·복호화하는 일 등)이 끝나면 그 오류를 자기 것으로 알고
// assertion으로 프로세스를 끝낸다(`CipherJob<AESCipherTraits>::ToResult` … `Assertion failed: errors->Empty()`). 목 백엔드가
// 응답을 늦게 줄수록(예: file-upload Recipe의 느린 업로드) 그 사이가 길어진다. 목 백엔드와의 연결은 MSW가 흉내 내므로 세션을
// 다시 쓰지 않아도 잃는 것이 없다. Node.js v26.11.0부터는 AES 작업이 남의 오류를 보지 않는다.
//
// Vitest는 테스트 파일마다 이 모듈을 다시 불러오므로, 한 프로세스에서 tls.connect를 한 번만 감싼다.
const processState = globalThis as typeof globalThis & { starterMockApiTlsSessionSkipped?: boolean }
if (processState.starterMockApiTlsSessionSkipped !== true) {
  processState.starterMockApiTlsSessionSkipped = true

  const mockApiHost = new URL(MOCK_API_BASE_URL).hostname
  const connect = tls.connect
  Reflect.set(tls, 'connect', function connectWithoutMockApiSession(this: unknown, ...args: unknown[]) {
    // 연결 옵션 가운데 목 백엔드로 가면서 세션을 넘기는 것만 세션을 뺀다.
    const withoutSession = args.map((arg) =>
      typeof arg === 'object' &&
      arg !== null &&
      Reflect.get(arg, 'session') !== undefined &&
      (Reflect.get(arg, 'servername') === mockApiHost || Reflect.get(arg, 'host') === mockApiHost)
        ? { ...arg, session: undefined }
        : arg,
    )
    return Reflect.apply(connect, this, withoutSession) as tls.TLSSocket
  })
}
