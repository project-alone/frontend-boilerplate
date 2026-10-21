// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/mocks/page-navigation.ts

import { http, passthrough } from 'msw'

/**
 * 페이지 탐색 요청(주소를 직접 열거나, 새로 고치거나, 링크를 따라 문서를 여는 요청)은 목 응답을 돌려주지 않고 그대로 보내는
 * MSW 핸들러. Base가 확장 지점 mockHandlers의 맨 앞(order 0)에 두어 다른 핸들러보다 먼저 거른다.
 *
 * 목 백엔드의 핸들러는 목 백엔드 주소(src/shared/api/base-url.ts의 MOCK_API_BASE_URL)로 가는 요청만 받으므로 페이지 주소와
 * 겹치지 않는다. 다만 브라우저의 MSW(Rendering Mode static-export의 서비스 워커)는 페이지가 보내는 모든 요청을 핸들러에 보이므로,
 * 주소를 가리지 않는 핸들러(예: '*\/products')가 목록에 들어와도 페이지 대신 목 응답이 열리지 않게 한 번 더 막는다.
 * 서버의 MSW(msw/node)는 서버가 보내는 요청만 받아 페이지 탐색 요청이 오지 않는다.
 */
export const pageNavigationHandlers = [
  http.all('*', ({ request }) => (request.mode === 'navigate' ? passthrough() : undefined)),
]
