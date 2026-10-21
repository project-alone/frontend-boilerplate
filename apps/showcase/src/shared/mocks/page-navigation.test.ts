// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/mocks/page-navigation.test.ts

// @vitest-environment node
import { getResponse, http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { pageNavigationHandlers } from './page-navigation'

// 페이지 주소와 겹치는, 주소를 가리지 않는 핸들러가 뒤에 있어도 페이지 탐색 요청은 받지 않는다.
const handlers = [...pageNavigationHandlers, http.get('*/products', () => HttpResponse.json([]))]

/** 브라우저가 페이지를 열 때 보내는 요청. Node.js의 Request는 mode에 navigate를 받지 않으므로 값만 바꾼다. */
function pageNavigation(url: string): Request {
  const request = new Request(url)
  Object.defineProperty(request, 'mode', { value: 'navigate' })
  return request
}

test('페이지 탐색 요청은 목 응답 없이 그대로 보낸다', async () => {
  const response = await getResponse(handlers, pageNavigation('http://localhost:3000/products'))

  expect(response?.headers.get('x-msw-intention')).toBe('passthrough')
})

test('페이지 탐색이 아닌 요청은 뒤의 핸들러가 받는다', async () => {
  const response = await getResponse(handlers, new Request('http://localhost:3000/products'))

  expect(await response?.json()).toEqual([])
})
