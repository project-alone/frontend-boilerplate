// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/shared/seo/og-image.test.tsx

// @vitest-environment node
// next/og는 Node.js에서 그린다(빌드할 때와 같은 환경).
import { afterEach, expect, test, vi } from 'vitest'
import { ogImage } from './og-image'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 네트워크 요청(http, https)을 기록하고 실패시킨다. next/og가 WebAssembly를 불러오는 data: 주소는 그대로 둔다. */
function recordNetworkRequests(): string[] {
  const requested: string[] = []
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.startsWith('data:')) return realFetch(input, init)
    requested.push(url)
    return Promise.reject(new Error(`OG 이미지가 네트워크를 썼습니다: ${url}`))
  })
  return requested
}

/** PNG의 너비와 높이(IHDR 청크) */
function pngSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

test('한글 제목과 설명을 담은 OG 이미지를 네트워크 없이 1200×630 PNG로 그린다', async () => {
  const requested = recordNetworkRequests()

  // next/og는 기본 글꼴에 없는 글자(한글 등)를 만나면 빌드 중에 Google Fonts에서 글꼴을 받으려 한다.
  // 함께 넣은 글꼴이 한글 11,172자를 모두 담고 있어 드문 음절도 받으러 가지 않는다.
  const response = await ogImage({ title: '똠양꿍과 뷁 · 상품 소개', description: '“검색”과 공유에 보이는 설명…' })
  const bytes = new Uint8Array(await response.arrayBuffer())

  expect(response.headers.get('content-type')).toBe('image/png')
  expect(Array.from(bytes.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 })
  expect(requested).toEqual([])
})
