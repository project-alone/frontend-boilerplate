// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/app/page.tsx

import { Home } from '@/features/home/home'
import { routing } from '@/shared/i18n/routing'

// i18n Recipe: 홈은 locale마다 src/app/[locale]/page.tsx(/ko, /en)에 있다. server Starter에서는 proxy가 홈(/)을 고른 locale의
// 홈으로 보내므로(src/shared/i18n/i18n-proxy.ts) 이 페이지는 보이지 않는다. 요청을 받는 서버가 없어 proxy가 없는
// static-export Starter에서는 이 페이지가 기본 locale의 홈을 보여 준다.
export default function HomePage() {
  return <Home locale={routing.defaultLocale} />
}
