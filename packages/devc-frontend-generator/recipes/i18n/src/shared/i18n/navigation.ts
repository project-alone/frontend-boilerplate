'use client'

import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/*
 * 지금 locale을 주소 앞에 붙여 이동하는 next-intl의 Link와 훅. 지금 locale은 I18nProvider가 주소의 [locale]에서 읽는다.
 * 클라이언트 모듈이라 서버 컴포넌트에서도 Link를 그대로 쓸 수 있다(클라이언트 컴포넌트로 그려진다). 서버 쪽 next-intl은
 * locale을 스스로 알 수 없으므로(request.ts) next-intl의 서버용 Link 대신 이것을 쓴다.
 */
const navigation = createNavigation(routing)

/** next/link와 같고, href 앞에 지금 locale을 붙인다(/i18n → /en/i18n). locale을 주면 그 locale의 주소로 간다. */
export const Link = navigation.Link
/** 지금 주소에서 locale을 뺀 경로(/en/i18n → /i18n) */
export const usePathname = navigation.usePathname
/** next/navigation의 useRouter와 같고, push·replace에 locale을 주면 그 locale의 주소로 간다. */
export const useRouter = navigation.useRouter
