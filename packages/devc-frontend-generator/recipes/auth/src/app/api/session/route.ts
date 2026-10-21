import { deleteSession, getSession, postSession } from '@/shared/auth/session-routes'

// 로그인 세션(ADR-0006). 브라우저의 로그인·로그아웃을 백엔드에 중계하고, 토큰은 암호화한 httpOnly 쿠키에 보관한다.
export const POST = postSession
export const GET = getSession
export const DELETE = deleteSession
