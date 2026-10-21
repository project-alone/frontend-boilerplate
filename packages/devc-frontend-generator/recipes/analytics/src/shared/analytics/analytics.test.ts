import { afterEach, expect, test, vi } from 'vitest'

// 기본 공급자(analytics-provider.ts)는 모듈을 불러올 때 NODE_ENV로 정해지므로, NODE_ENV를 바꾼 뒤 모듈을 새로 불러온다.
async function load(nodeEnv: string) {
  vi.stubEnv('NODE_ENV', nodeEnv)
  vi.resetModules()
  const { trackEvent } = await import('./analytics')
  const { analyticsClientInstrumentation } = await import('./analytics-instrumentation-client')
  return { trackEvent, analyticsClientInstrumentation }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

test('개발 서버에서는 처음 연 페이지와 App Router로 옮겨 가는 페이지의 페이지뷰를 브라우저 콘솔에만 남긴다', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  window.history.replaceState(null, '', '/products?page=2')
  const { analyticsClientInstrumentation } = await load('development')

  analyticsClientInstrumentation.register()
  analyticsClientInstrumentation.onRouterTransitionStart('/members?sort=name')
  analyticsClientInstrumentation.onRouterTransitionStart('http://localhost:3000/charts')

  expect(info.mock.calls).toEqual([
    ['[analytics] page_view', '/products?page=2'],
    ['[analytics] page_view', '/members?sort=name'],
    ['[analytics] page_view', '/charts'],
  ])
})

test('개발 서버에서는 이벤트를 속성과 함께 브라우저 콘솔에만 남긴다', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const { trackEvent } = await load('development')

  trackEvent('signup_completed', { plan: 'pro', seats: 3 })
  trackEvent('logout_clicked')

  expect(info.mock.calls).toEqual([
    ['[analytics] event', 'signup_completed', { plan: 'pro', seats: 3 }],
    ['[analytics] event', 'logout_clicked', {}],
  ])
})

test.each(['production', 'test'])(
  'NODE_ENV가 %s이면 공급자를 붙이기 전까지 페이지뷰와 이벤트를 콘솔에 남기거나 보내지 않는다',
  async (nodeEnv) => {
    const logs = (['log', 'info', 'debug', 'warn', 'error'] as const).map((method) => vi.spyOn(console, method))
    const fetch = vi.spyOn(globalThis, 'fetch')
    const { trackEvent, analyticsClientInstrumentation } = await load(nodeEnv)

    analyticsClientInstrumentation.register()
    analyticsClientInstrumentation.onRouterTransitionStart('/products')
    trackEvent('signup_completed', { plan: 'pro' })

    for (const log of logs) expect(log).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  },
)
