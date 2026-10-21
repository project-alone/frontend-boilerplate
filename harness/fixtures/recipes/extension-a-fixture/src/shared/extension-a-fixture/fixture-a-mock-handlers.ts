import { http, HttpResponse } from 'msw'

/**
 * 시험용 MSW 핸들러(확장 지점 mockHandlers, order 200). 다른 Recipe(extension-b-fixture)의 명세 조각에서 생성된 핸들러가 받는
 * 요청 하나(/betas/42)를 덮어쓰고, b의 핸들러(order 100)와 같은 요청(/fixture-mock-order)에도 응답한다.
 */
export const fixtureAMockHandlers = [
  http.get('*/betas/42', () => HttpResponse.json({ id: 42, label: 'a가 덮어쓴 베타' })),
  http.get('*/fixture-mock-order', () => HttpResponse.json('a')),
]
