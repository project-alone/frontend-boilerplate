import { expect, test } from 'vitest'
import { getLandingPage } from '@/shared/api/generated'
import { MOCK_LANDING_PAGES } from './landing'

// 랜딩의 목 백엔드는 실제 콘텐츠 API처럼 locale마다 다른 콘텐츠를 돌려주고, 콘텐츠가 없는 locale은 404로 답한다(명세).
// 요청은 Vitest의 MSW(@/shared/mocks/node)가 받는다.

test.each(['ko', 'en'] as const)('%s 콘텐츠를 돌려준다', async (locale) => {
  await expect(getLandingPage(locale)).resolves.toEqual(MOCK_LANDING_PAGES[locale])
})

test('locale마다 다른 문구를 돌려준다', async () => {
  const [ko, en] = await Promise.all([getLandingPage('ko'), getLandingPage('en')])

  expect(ko.hero.heading).toBe('첫 커밋부터 깨끗한 프론트엔드 프로젝트')
  expect(en.hero.heading).toBe('A clean frontend project from the first commit')
})

test('콘텐츠가 없는 locale은 404로 거절한다', async () => {
  await expect(getLandingPage('fr')).rejects.toMatchObject({ name: 'ApiError', status: 404 })
})
