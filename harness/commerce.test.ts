import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, inject, test } from 'vitest'
import { freePort, run } from './run.ts'
import { buildRouteLine, expectFileToPass, readTree, runVitestScript, useStarter } from './starter.ts'

test('커머스 Archetype은 ISR 화면이 있어 server만 지원하므로, static-export Starter에는 archetype.json에 적은 이유와 함께 넣지 않는다', () => {
  const workdir = mkdtempSync(join(tmpdir(), 'dcgen-commerce-static-'))
  try {
    const result = run(
      inject('dcgenBin'),
      ['new', 'my-app', '--rendering-mode', 'static-export', '--archetype', 'commerce', '--skip-install'],
      workdir,
    )

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Archetype commerce은(는) Rendering Mode static-export에서 쓸 수 없습니다(지원: server).')
    expect(result.output).toContain('상품 목록과 상세는 ISR이라 정한 시간마다 다시 렌더링할 Next.js 서버가 있어야 합니다.')
    expect(readdirSync(workdir)).toEqual([])
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
})

// Query Domain에서 `mutation --optimistic`이 만든 뼈대에 개발자가 채우는 함수(apply<OperationId>)의 선언. 바로 위의 설명 주석부터
// 그 뮤테이션 훅 앞까지다.
const APPLY_DECLARATIONS = /\/\/ \w+의 응답이 오기 전에[\s\S]*?\n\n(?=export function use\w+Mutation)/g

/** 쿼리 모듈에서 apply<OperationId>의 선언을 모두 뺀다. */
function withoutApplyDeclarations(source: string | undefined): string {
  return (source ?? '').replace(APPLY_DECLARATIONS, '')
}

// 배포용 빌드(목을 끄고 백엔드 주소가 없음)와 목 빌드(Starter의 GitLab CI의 build 잡과 E2E)의 환경 변수(ADR-0011)
const DEPLOY_BUILD_ENV = { API_MOCKING: undefined, API_BASE_URL: '' }
const MOCK_BUILD_ENV = { API_MOCKING: 'enabled', API_BASE_URL: '' }

// 하네스 매트릭스: Base에 커머스 Archetype을 넣은 server Starter를 만들어, Starter 자신의 스크립트와 Archetype이 함께 넣은
// 테스트(장바구니·주문을 기억하는 목 백엔드, 낙관적 업데이트와 되돌리기, 다단계 주문서, 가짜 결제, e2e/commerce.spec.ts)가
// Archetype이 쓰는 Recipe(optimistic-update, multi-step-form)의 테스트와 함께 통과하는지 본다. 모든 Recipe·Archetype을 켠
// 조합은 showcase-starter.test.ts가 본다.
describe('Rendering Mode server에 커머스 Archetype을 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-commerce-',
    renderingMode: 'server',
    archetypes: ['commerce'],
    install: true,
    playwright: true,
  })

  test('Archetype이 쓰는 Recipe가 함께 들어 있고, 머리글에 쇼핑 링크를, MSW 핸들러 목록에 목 백엔드를 더한다', () => {
    // optimistic-update의 할 일 목록, multi-step-form의 다단계 폼 부품
    expect(existsSync(join(starter.dir, 'src/app/todos/page.tsx'))).toBe(true)
    expect(existsSync(join(starter.dir, 'src/shared/multi-step-form/use-form-steps.ts'))).toBe(true)
    const appShell = readFileSync(join(starter.dir, 'src/app/app-shell.tsx'), 'utf8')
    const header = /<header[^>]*>([\s\S]*?)<\/header>/.exec(appShell)?.[1] ?? ''
    expect(header.match(/<\w+ \/>/g)).toEqual(['<ShopLink />'])
    const handlers = readFileSync(join(starter.dir, 'src/shared/mocks/handlers.ts'), 'utf8')
    expect(handlers).toContain('...shopHandlers,')
    // sitemap을 만드는 Recipe(seo)가 없으므로 sitemap 규칙은 쓰이지 않고 조립 파일도 없다.
    expect(existsSync(join(starter.dir, 'src/app/sitemap-rules.ts'))).toBe(false)
  })

  // Archetype의 Query Domain은 `npm run g`의 query·mutation이 만드는 코드에, 응답 전에 보일 장바구니를 만드는 함수만 채운
  // 것이다(ADR-0008). 지우고 같은 순서로 다시 만든 뒤에는 Archetype의 코드로 되돌려 아래 검사가 Archetype의 코드로 돈다.
  test('Query Domain(catalog, cart, orders)은 npm run g -- query·mutation이 만든 코드에 장바구니의 apply<OperationId>만 채웠다', () => {
    const domains = ['catalog', 'cart', 'orders'].map((name) => `src/queries/${name}`)
    const archetype = Object.fromEntries(domains.map((domain) => [domain, readTree(join(starter.dir, domain))]))
    for (const domain of domains) rmSync(join(starter.dir, domain), { recursive: true })

    try {
      for (const args of [
        ['query', 'listCatalogProducts'],
        ['query', 'getCatalogProduct'],
        ['query', 'getCart'],
        ['mutation', 'createCart'],
        ['mutation', 'addCartItem', '--optimistic', 'getCart'],
        ['mutation', 'updateCartItem', '--optimistic', 'getCart'],
        ['mutation', 'removeCartItem', '--optimistic', 'getCart'],
        ['query', 'getOrder'],
        ['mutation', 'placeOrder'],
        ['mutation', 'confirmOrderPayment'],
      ]) {
        starter.expectNpmSuccess(['run', 'g', '--', ...args])
      }

      expect(readTree(join(starter.dir, 'src/queries/catalog'))).toEqual(archetype['src/queries/catalog'])
      expect(readTree(join(starter.dir, 'src/queries/orders'))).toEqual(archetype['src/queries/orders'])
      const generatedCart = readTree(join(starter.dir, 'src/queries/cart'))
      const archetypeCart = archetype['src/queries/cart'] ?? {}
      expect(generatedCart['cart.keys.ts']).toBe(archetypeCart['cart.keys.ts'])
      expect(generatedCart['cart.queries.ts']?.match(APPLY_DECLARATIONS)).toHaveLength(3)
      expect(withoutApplyDeclarations(generatedCart['cart.queries.ts'])).toBe(
        withoutApplyDeclarations(archetypeCart['cart.queries.ts']),
      )
      // 생성한 뼈대는 캐시를 그대로 두고, Archetype은 수량과 합계를 바꾼다.
      expect(generatedCart['cart.queries.ts']).toContain('= (current) =>')
      expect(archetypeCart['cart.queries.ts']).toContain('totalPrice: items.reduce(')
    } finally {
      for (const domain of domains) {
        rmSync(join(starter.dir, domain), { recursive: true, force: true })
        for (const [file, content] of Object.entries(archetype[domain] ?? {})) {
          starter.writeFile(`${domain}/${file}`, content)
        }
      }
    }
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트(목 백엔드, 장바구니의 낙관적 업데이트와 되돌리기, 주문서, 가짜 결제), 스토리 검사를 통과한다', () => {
    for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check']]) {
      starter.expectNpmSuccess(script)
    }
    const report = runVitestScript(starter, ['test'])
    for (const file of [
      'src/shared/mocks/shop.test.ts',
      'src/shared/shop/cart-id.test.ts',
      'src/features/shop-catalog/catalog-product-list.test.tsx',
      'src/features/shop-nav/shop-nav.test.tsx',
      'src/features/shop-cart/add-to-cart-form.test.tsx',
      'src/features/shop-cart/cart-view.test.tsx',
      'src/features/shop-checkout/checkout-form.test.tsx',
      'src/features/shop-checkout/fake-payment.test.tsx',
      // Archetype이 쓰는 Recipe의 테스트도 함께 돈다.
      'src/features/todo-list/todo-list.test.tsx',
      'src/features/partner-application/partner-application-form.test.tsx',
    ]) {
      expectFileToPass(report, file, 1)
    }

    const stories = runVitestScript(starter, ['run', 'test:storybook'])
    expectFileToPass(stories, 'src/features/shop-checkout/checkout-form.stories.tsx', 1)
  })

  test('배포용 빌드는 백엔드 주소 없이 실패하고, 목 빌드는 상품 목록과 상세를 ISR로 미리 렌더링한다', () => {
    // 상품 목록과 상세는 빌드할 때 백엔드를 부르므로 배포용 빌드에는 API_BASE_URL이 있어야 한다(ADR-0011).
    const deploy = starter.npm(['run', 'build'], DEPLOY_BUILD_ENV)
    expect(deploy.status, deploy.failureMessage).not.toBe(0)
    expect(deploy.output).toContain('API_BASE_URL 환경 변수가 없습니다. 빌드할 때 데이터를 가져오는 페이지')

    const { output } = starter.expectNpmSuccess(['run', 'build'], MOCK_BUILD_ENV)

    // 목록은 5분, 상세는 1분마다 다시 렌더링하고(Revalidate), 상세는 빌드할 때 모든 상품을 렌더링한다(●).
    expect(buildRouteLine(output, '/shop'), output).toMatch(/○.*5m/)
    expect(buildRouteLine(output, '/shop/products/1'), output).toMatch(/●.*1m/)
    // 장바구니와 주문서는 페이지 뼈대만 미리 렌더링하고, 결제창과 주문 완료는 요청마다 주문을 가져온다.
    expect(buildRouteLine(output, '/shop/cart'), output).toContain('○')
    expect(buildRouteLine(output, '/shop/checkout'), output).toContain('○')
    expect(buildRouteLine(output, '/shop/orders/[orderId]'), output).toContain('ƒ')
    expect(buildRouteLine(output, '/shop/orders/[orderId]/payment'), output).toContain('ƒ')
    // 미리 렌더링한 HTML에는 빌드할 때 MSW가 돌려준 상품이 담겼다.
    const list = readFileSync(join(starter.dir, '.next/server/app/shop.html'), 'utf8')
    expect(list).toContain('오가닉 코튼 티셔츠')
    expect(list).toContain('₩19,000')
    const detail = readFileSync(join(starter.dir, '.next/server/app/shop/products/6.html'), 'utf8')
    expect(detail).toContain('한정판 세라믹 머그')
    expect(detail).toContain('남은 수량 2개')
  })

  test('빌드한 앱에서 E2E(상품 탐색 → 장바구니 → 주문서 → 가짜 결제 → 주문 완료, 거절된 장바구니 변경의 되돌리기, 접근성)가 통과한다', async () => {
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})
