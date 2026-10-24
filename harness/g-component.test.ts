import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  dcgen,
  expectFilesToMatchSnapshots,
  expectFileToPass,
  readTree,
  restoreBeforeEach,
  runVitestScript,
  type Starter,
  useStarter,
} from './starter.ts'

// 생성 결과 스냅샷
const SNAPSHOTS = './__snapshots__/g-component'

// component Schematic이 파일을 만드는 곳. Feature는 src/features/<feature>/, 공통 UI는 src/shared/ui/다.
const FEATURES_DIR = 'src/features'
const SHARED_UI_DIR = 'src/shared/ui'

// Starter의 검사를 통과하는지 볼 때 만드는 컴포넌트: 새 Feature, 이미 있는 Feature(Base의 product-list), 공통 UI.
// stem은 만들어지는 두 파일의 확장자를 뺀 경로다.
const CHECKED_COMPONENTS = [
  { args: ['order-summary', '--feature', 'orders'], stem: 'src/features/orders/order-summary' },
  { args: ['ProductCard', '--feature', 'product-list'], stem: 'src/features/product-list/product-card' },
  { args: ['status-badge', '--shared'], stem: 'src/shared/ui/status-badge' },
]

/**
 * CHECKED_COMPONENTS를 만든 Starter가 타입 검사, lint, 포맷 검사를 통과하고, 생성된 테스트(내용과 접근성 검사)가 실제로
 * 실행되어 통과하는지 본다.
 */
function expectGeneratedComponentsToPassStarterChecks(starter: Starter): void {
  for (const { args } of CHECKED_COMPONENTS) {
    const result = dcgen(starter, ['g', 'component', ...args])
    expect(result.status, result.output).toBe(0)
  }

  for (const script of ['typecheck', 'lint', 'format:check']) starter.expectNpmSuccess(['run', script])
  const unit = runVitestScript(starter, ['test'])
  for (const { stem } of CHECKED_COMPONENTS) expectFileToPass(unit, `${stem}.test.tsx`, 1)
}

describe('server Starter', () => {
  const starter = useStarter({ prefix: 'dcgen-g-component-', install: true })
  // 테스트마다 Feature와 공통 UI를 생성 직후 상태로 되돌린다.
  restoreBeforeEach(starter, [FEATURES_DIR, SHARED_UI_DIR])

  test('dcgen g component --feature는 Feature 폴더에 kebab-case 파일 이름으로 컴포넌트와 테스트를 만들고, 스토리는 만들지 않는다', async () => {
    const result = dcgen(starter, ['g', 'component', 'order-summary', '--feature', 'orders'])

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('src/features/orders/order-summary.tsx')
    expect(Object.keys(readTree(join(starter.dir, 'src/features/orders'))).sort()).toEqual([
      'order-summary.test.tsx',
      'order-summary.tsx',
    ])
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src/features/orders', ['order-summary.tsx', 'order-summary.test.tsx'])
  })

  test('npm run g -- component --shared는 공통 UI에 PascalCase 이름을 kebab-case 파일 이름으로 바꿔 컴포넌트와 테스트를 만든다', async () => {
    const before = Object.keys(readTree(join(starter.dir, SHARED_UI_DIR)))

    const result = starter.npm(['run', 'g', '--', 'component', 'StatusBadge', '--shared'])

    expect(result.status, result.failureMessage).toBe(0)
    const created = Object.keys(readTree(join(starter.dir, SHARED_UI_DIR))).filter((file) => !before.includes(file))
    expect(created.sort()).toEqual(['status-badge.test.tsx', 'status-badge.tsx'])
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, SHARED_UI_DIR, created)
  })

  test('같은 이름의 파일이 하나라도 있으면 덮어쓰지 않고 겹치는 파일을 알린 뒤 아무 파일도 만들지 않고 실패한다', () => {
    // Base의 공통 UI에는 icons.tsx가 있고 icons.test.tsx는 없다.
    const before = readTree(join(starter.dir, SHARED_UI_DIR))

    const result = dcgen(starter, ['g', 'component', 'Icons', '--shared'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('src/shared/ui/icons.tsx')
    expect(result.output).not.toContain('src/shared/ui/icons.test.tsx')
    expect(readTree(join(starter.dir, SHARED_UI_DIR))).toEqual(before)
  })

  test('확장자만 다르고 import 경로가 같은 모듈이 있어도 같은 이름으로 보고 아무 파일도 만들지 않는다', () => {
    // Base의 공통 UI에는 class-name.ts가 있다. class-name.tsx를 더하면 './class-name' import가 기존 모듈로 풀린다.
    const before = readTree(join(starter.dir, SHARED_UI_DIR))

    const result = dcgen(starter, ['g', 'component', 'class-name', '--shared'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('src/shared/ui/class-name.ts')
    expect(readTree(join(starter.dir, SHARED_UI_DIR))).toEqual(before)
  })

  test('개발자가 손으로 쓴 테스트만 있어도 Feature 폴더에 컴포넌트를 만들지 않는다', () => {
    starter.writeFile(`${FEATURES_DIR}/orders/order-summary.test.tsx`, '// 개발자가 먼저 쓴 테스트\n')
    const before = readTree(join(starter.dir, FEATURES_DIR))

    const result = dcgen(starter, ['g', 'component', 'order-summary', '--feature', 'orders'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('src/features/orders/order-summary.test.tsx')
    expect(readTree(join(starter.dir, FEATURES_DIR))).toEqual(before)
  })

  test.each([
    { problem: '둘 곳을 고르지 않은 컴포넌트', args: ['order-summary'], reason: '컴포넌트를 둘 곳을 고르세요: --feature' },
    {
      problem: '--feature와 --shared를 함께 쓴 컴포넌트',
      args: ['order-summary', '--feature', 'orders', '--shared'],
      reason: '--feature와 --shared는 함께 쓸 수 없습니다',
    },
    { problem: '밑줄이 들어간 이름', args: ['order_summary', '--shared'], reason: "쓸 수 없는 컴포넌트 이름입니다: 'order_summary'" },
    { problem: '숫자로 시작하는 이름', args: ['1-badge', '--shared'], reason: "쓸 수 없는 컴포넌트 이름입니다: '1-badge'" },
    {
      problem: '하위 폴더를 만드는 이름',
      args: ['summary/total', '--feature', 'orders'],
      reason: '하위 폴더는 만들지 않습니다',
    },
    {
      problem: '하위 폴더를 만드는 Feature 이름',
      args: ['order-summary', '--feature', 'orders/admin'],
      reason: "쓸 수 없는 Feature 이름입니다: 'orders/admin'",
    },
    {
      problem: '공통 UI 컴포넌트 파일이 가져오는 이름과 겹치는 이름',
      args: ['VariantProps', '--shared'],
      reason: '생성하는 코드가 쓰는 이름(VariantProps)과 겹칩니다',
    },
  ])('$problem: 이유를 알리고 아무 파일도 만들지 않은 채 실패한다', ({ args, reason }) => {
    const before = { features: readTree(join(starter.dir, FEATURES_DIR)), ui: readTree(join(starter.dir, SHARED_UI_DIR)) }

    const result = dcgen(starter, ['g', 'component', ...args])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain(reason)
    expect({ features: readTree(join(starter.dir, FEATURES_DIR)), ui: readTree(join(starter.dir, SHARED_UI_DIR)) }).toEqual(
      before,
    )
  })

  test('component Schematic이 만든 코드로 Starter의 타입 검사, lint, 포맷 검사, 테스트(접근성 검사 포함)가 모두 통과한다', () => {
    expectGeneratedComponentsToPassStarterChecks(starter)
  })
})

// 컴포넌트 코드는 Rendering Mode와 상관없지만 static-export Starter의 설정(next.config.ts, Vitest 설정 등)에서도 검사를 통과하는지 본다.
describe('static-export Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-g-component-static-',
    renderingMode: 'static-export',
    install: true,
  })

  test('component Schematic이 만든 코드로 Starter의 검사가 모두 통과한다', () => {
    expectGeneratedComponentsToPassStarterChecks(starter)
  })
})
