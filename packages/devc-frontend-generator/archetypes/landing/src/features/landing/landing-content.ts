import { cache } from 'react'
import { getLandingPageQueryOptions } from '@/queries/landing/landing.queries'
import type { LandingPageContent } from '@/shared/api/generated/model'
import type { Locale } from '@/shared/i18n/routing'
import { getQueryClient } from '@/shared/query-client/get-query-client'

/**
 * locale의 랜딩 페이지 콘텐츠를 서버에서 가져온다. 랜딩 페이지(src/app/[locale]/landing/)의 metadata, 화면, 공유 이미지가
 * 빌드할 때 locale마다 부른다. 요청과 쿼리 키는 landing Query Domain의 queryOptions를 그대로 쓴다(ADR-0008). 서버의
 * QueryClient는 부를 때마다 새로 만들어지므로, 한 페이지를 렌더링하는 동안(metadata와 화면) 같은 locale의 요청은 React의
 * cache로 한 번만 보낸다.
 *
 * 다른 화면처럼 서버가 가져온 데이터를 hydration으로 넘기지 않고, 서버 컴포넌트(Landing)에 props로 넘긴다. 랜딩의 콘텐츠는
 * 빌드한 뒤 바뀌지 않아 브라우저의 쿼리 캐시에 둘 까닭이 없고, 넘기면 staleTime이 지난 데이터(빌드한 지 오래된 정적 페이지는
 * 처음부터 그렇다)를 브라우저가 다시 가져와 배포한 정적 페이지가 방문마다 백엔드를 부르게 된다. 콘텐츠를 바꾸면 다시 빌드한다.
 */
export const loadLandingPage = cache((locale: Locale): Promise<LandingPageContent> =>
  getQueryClient().query(getLandingPageQueryOptions(locale)),
)
