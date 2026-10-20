import { expect, test } from 'vitest'
import { contrastRatio } from './chart-contrast'

test('브라우저가 계산한 색으로 WCAG의 명도 대비를 잰다', () => {
  expect(contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBeCloseTo(21)
  // #767676은 흰 배경에서 4.5:1을 겨우 넘는 회색으로 알려져 있다(4.54:1).
  expect(contrastRatio('rgb(255, 255, 255)', 'rgb(118, 118, 118)')).toBeCloseTo(4.54, 2)
  expect(contrastRatio('rgb(26, 26, 26)', 'rgb(26, 26, 26)')).toBe(1)
})

test('잴 수 없는 색이면 통과시키지 않고 실패한다', () => {
  expect(() => contrastRatio('var(--color-primary)', 'rgb(255, 255, 255)')).toThrow('var(--color-primary)')
})
