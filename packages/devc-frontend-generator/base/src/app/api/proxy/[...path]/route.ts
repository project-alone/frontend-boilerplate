import { forwardToBackend } from '@/shared/api/bff-proxy'

// BFF 프록시(ADR-0006). 브라우저의 API 요청(/api/proxy/*)을 백엔드로 그대로 전달한다.
export const GET = forwardToBackend
export const HEAD = forwardToBackend
export const POST = forwardToBackend
export const PUT = forwardToBackend
export const PATCH = forwardToBackend
export const DELETE = forwardToBackend
