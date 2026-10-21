// 상태 확인 주소. 컨테이너의 HEALTHCHECK(Dockerfile)와 Kubernetes의 probe처럼 서버가 요청을 처리하는지 묻는 곳이 부른다.
// 백엔드를 부르지 않으므로 백엔드가 잠시 응답하지 않아도 컨테이너를 다시 시작하지 않는다. 백엔드 주소(API_BASE_URL)가 빠진
// 서버는 모든 요청에 500으로 응답하므로 여기서도 상태 확인이 실패한다(src/shared/api/api-instrumentation.ts).
export function GET(): Response {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}
