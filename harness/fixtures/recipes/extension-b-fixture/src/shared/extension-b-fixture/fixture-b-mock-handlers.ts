import { http, HttpResponse } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'

/** 시험용 MSW 핸들러(확장 지점 mockHandlers, order 100). a의 핸들러(order 200)와 같은 요청에 응답한다. */
export const fixtureBMockHandlers = [http.get(`${MOCK_API_BASE_URL}/fixture-mock-order`, () => HttpResponse.json('b'))]
