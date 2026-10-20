import type { NextConfig } from 'next'

/** 시험용 next.config 래퍼: 적용된 순서가 드러나도록 FIXTURE_NEXT_CONFIG에 자기 이름을 덧붙인다. */
export function withFixtureB(config: NextConfig): NextConfig {
  return { ...config, env: { ...config.env, FIXTURE_NEXT_CONFIG: `${config.env?.['FIXTURE_NEXT_CONFIG'] ?? ''}b` } }
}
