// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/chart/e2e/chart.spec.ts

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { contrastRatio, NON_TEXT_CONTRAST_MIN, TEXT_CONTRAST_MIN } from '@/shared/chart/chart-contrast'

// chart Recipe: /charts의 시계열 차트(일별 방문 수)와 비교 차트(판매 채널별 매출)를 빌드한 앱에서 확인한다.
// 데이터는 샘플 명세(openapi.yaml)의 listDailyVisits·listChannelSales example이고, E2E에서는 MSW가 돌려준다.
// 브라우저가 데이터를 가져와 그리므로 Rendering Mode server와 static-export에서 같은 spec이 돈다.

// 페이지에서 난 오류(예: hydration 불일치)를 모은다.
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

/** 차트 두 개를 다 그릴 때까지 기다린다. */
async function waitForCharts(page: Page) {
  await expect(page.locator('.recharts-line-curve')).toBeVisible()
  await expect(page.locator('.recharts-bar .recharts-rectangle')).toHaveCount(8)
}

test('브라우저가 가져온 샘플 통계로 시계열 차트와 비교 차트를 그리고, 같은 값을 스크린 리더용 표로 제공한다', async ({
  page,
}) => {
  const errors = collectErrors(page)

  const response = await page.goto('/charts')

  // 미리 렌더링한 HTML에는 데이터가 없고, 브라우저가 데이터를 받은 뒤에 차트를 그린다.
  expect((await response?.text()) ?? '').toContain('일별 방문 수를 불러오는 중입니다.')
  await expect(page.getByRole('heading', { level: 1, name: '차트' })).toBeVisible()
  await waitForCharts(page)

  const visits = page.getByRole('figure', { name: '일별 방문 수' })
  await expect(visits).toBeVisible()
  await expect(visits.getByRole('table', { name: '일별 방문 수' }).getByRole('row')).toHaveCount(15)
  await expect(visits.getByRole('rowheader', { name: '10월 14일' })).toBeAttached()

  const sales = page.getByRole('figure', { name: '판매 채널별 매출' })
  await expect(sales).toBeVisible()
  await expect(sales.getByRole('table', { name: '판매 채널별 매출' }).getByRole('row')).toHaveCount(5)
  await expect(sales.getByText('이번 달 합계 120,200,000원, 지난달 합계 114,700,000원')).toBeVisible()

  // 그림(범례 포함)은 보조 기술에서 숨기므로, 접근성 트리에는 캡션과 표의 값만 남는다.
  const charts = page.locator('.recharts-wrapper')
  await expect(charts).toHaveCount(2)
  expect(
    await charts.evaluateAll((wrappers) => wrappers.map((chart) => chart.closest('[aria-hidden="true"]') !== null)),
  ).toEqual([true, true])
  expect(errors).toEqual([])
})

// dark-mode Recipe를 함께 넣은 Starter에서는 운영체제가 다크 모드이면 다크 테마로 열리므로, 다크 테마의 토큰으로도 확인한다.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`운영체제가 ${colorScheme === 'light' ? '라이트' : '다크'} 모드이면`, () => {
    test.use({ colorScheme })

    test('차트의 선·막대·축 글자가 배경 위에서 읽히고 WCAG 2.2 AA 위반이 없다', async ({ page }) => {
      await page.goto('/charts')
      await waitForCharts(page)

      const background = await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor)
      const line = await page.locator('.recharts-line-curve').evaluate((path) => getComputedStyle(path).stroke)
      // 비교 차트의 계열은 지난달(테두리만 그린 막대), 이번 달(채운 막대) 순서다.
      const [previous, current] = await page.locator('.recharts-bar').evaluateAll((series) =>
        series.map((bar) => {
          const { fill, stroke } = getComputedStyle(bar.querySelector('.recharts-rectangle') ?? bar)
          return { fill, stroke }
        }),
      )
      const ticks = await page
        .locator('.recharts-cartesian-axis-tick-value')
        .evaluateAll((texts) => texts.map((text) => getComputedStyle(text).fill))

      // 두 계열은 색만으로 나누지 않는다. 지난달은 테두리만 그리고(안쪽은 배경색) 이번 달은 채운다.
      expect(previous?.fill).toBe(background)
      for (const mark of [line, previous?.stroke ?? '', current?.fill ?? '']) {
        expect(contrastRatio(mark, background), mark).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST_MIN)
      }
      expect(ticks.length).toBeGreaterThan(0)
      for (const tick of ticks) expect(contrastRatio(tick, background), tick).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN)
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
      expect(violations).toEqual([])
    })
  })
}
