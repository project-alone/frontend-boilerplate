/**
 * 시험용 sitemap 규칙(확장 지점 sitemap, order 200). sitemap(src/app/sitemap.ts)이 있는 Starter에서만 조립된다
 * (harness/extension-points.test.ts가 seo Recipe와 함께 켜 본다).
 */
export const fixtureASitemapRules = { exclude: ['/fixture-a-private'] }
