import { http, HttpResponse } from 'msw'

// MSW가 가로챌 요청과 돌려줄 응답의 목록. Vitest, Playwright, 개발 서버가 모두 이 목록을 쓴다.
// 지금은 MSW가 동작하는지 보여 주는 예시 핸들러 하나뿐이다. API 계층을 붙이면 OpenAPI 명세에서
// 생성한 핸들러로 바꾼다.
export const handlers = [
  http.get('https://api.example.com/greeting', () => HttpResponse.json({ message: 'MSW가 보낸 인사입니다' })),
]
