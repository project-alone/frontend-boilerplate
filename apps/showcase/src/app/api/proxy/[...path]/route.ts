// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/app/api/proxy/[...path]/route.ts

import { forwardToBackend } from '@/shared/api/bff-proxy'

// BFF 프록시(ADR-0006). 브라우저의 API 요청(/api/proxy/*)을 백엔드로 그대로 전달한다.
export const GET = forwardToBackend
export const HEAD = forwardToBackend
export const POST = forwardToBackend
export const PUT = forwardToBackend
export const PATCH = forwardToBackend
export const DELETE = forwardToBackend
