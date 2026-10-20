import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import { freePort, start, waitForServer } from './run.ts'
import { MSW_PROBE_ROUTE, SAMPLE_API_URL, SAMPLE_PRODUCTS, useStarter, writeMswProbePage } from './starter.ts'

// Base의 샘플 명세(openapi.yaml)에서 생성한 MSW 핸들러가 받는 요청과 돌려주는 응답(명세의 example)
const EXAMPLE_API = {
  url: SAMPLE_API_URL,
  body: SAMPLE_PRODUCTS,
  /** 응답을 화면에 그렸을 때 보이는 글자 */
  text: '기본 티셔츠',
}

// Starter 하나를 만들어 설치해 두고, 테스트마다 다시 설치하지 않도록 모든 테스트가 함께 쓴다.
const starter = useStarter({ prefix: 'dcgen-test-tools-', install: true, playwright: true })

describe('Vitest와 Testing Library', () => {
  test('Starter의 단위·컴포넌트 테스트가 통과한다', () => {
    starter.expectNpmSuccess(['test'])
  })

  test('Testing Library로 작성한 컴포넌트 테스트를 npm test로 실행할 수 있다', () => {
    starter.writeFile(
      'src/app/harness-component.test.tsx',
      `import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

function Greeting({ name }: { name: string }) {
  return <p>안녕하세요, {name}</p>
}

test('인사말을 보여 준다', () => {
  render(<Greeting name="하네스" />)

  expect(screen.getByText('안녕하세요, 하네스')).toBeInTheDocument()
})
`,
    )

    starter.expectNpmSuccess(['test', '--', 'src/app/harness-component.test.tsx'])
  })

  test('테스트가 보내는 요청은 MSW가 받고, 테스트마다 응답을 바꿀 수 있다', () => {
    starter.writeFile(
      'src/app/harness-msw.test.ts',
      `import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/shared/mocks/node'

test('샘플 명세에서 생성한 핸들러가 응답한다', async () => {
  const response = await fetch('${EXAMPLE_API.url}')

  expect(await response.json()).toEqual(${JSON.stringify(EXAMPLE_API.body)})
})

test('server.use로 이 테스트에서만 응답을 바꾼다', async () => {
  server.use(http.get('${EXAMPLE_API.url}', () => HttpResponse.json({ message: '바꾼 응답' })))

  const response = await fetch('${EXAMPLE_API.url}')

  expect(await response.json()).toEqual({ message: '바꾼 응답' })
})
`,
    )

    starter.expectNpmSuccess(['test', '--', 'src/app/harness-msw.test.ts'])
  })
})

describe('Storybook', () => {
  test('Storybook 개발 서버가 뜬다', () => {
    starter.expectNpmSuccess(['run', 'storybook', '--', '--ci', '--smoke-test'])
  })

  test('스토리마다 axe 접근성 검사가 돌고, Starter의 스토리는 모두 통과한다', () => {
    starter.expectNpmSuccess(['run', 'test:storybook'])
  })

  test('WCAG 2.2 AA를 어기는 스토리가 있으면 접근성 검사가 실패한다', () => {
    const story = 'src/app/harness-a11y.stories.tsx'
    // 24px보다 작은 버튼 두 개를 붙여 둔다(WCAG 2.2 성공 기준 2.5.8 위반).
    starter.writeFile(
      story,
      `import type { Meta, StoryObj } from '@storybook/nextjs-vite'

function TinyButtons() {
  const style = { width: 12, height: 12, padding: 0, margin: 0, fontSize: 8 }
  return (
    <div>
      <button type="button" style={style}>A</button>
      <button type="button" style={style}>B</button>
    </div>
  )
}

const meta = { component: TinyButtons } satisfies Meta<typeof TinyButtons>

export default meta

export const Default: StoryObj<typeof meta> = {}
`,
    )

    try {
      const result = starter.npm(['run', 'test:storybook', '--', story])

      expect(result.status, result.failureMessage).not.toBe(0)
      expect(result.output).toContain('target-size')
    } finally {
      rmSync(join(starter.dir, story))
    }
  })
})

describe('Playwright', () => {
  let e2eEnv: NodeJS.ProcessEnv

  beforeAll(async () => {
    e2eEnv = { E2E_PORT: String(await freePort()) }
    writeMswProbePage(starter)
    starter.expectNpmSuccess(['run', 'build'])
  })

  test('스모크 E2E가 빌드된 Starter를 대상으로 통과한다', () => {
    starter.expectNpmSuccess(['run', 'test:e2e'], e2eEnv)
  })

  test('E2E 대상 서버가 보내는 API 요청은 MSW가 받는다', () => {
    const spec = 'e2e/harness-msw.spec.ts'
    starter.writeFile(
      spec,
      `import { expect, test } from '@playwright/test'

test('서버 컴포넌트가 받은 MSW 응답을 보여 준다', async ({ page }) => {
  await page.goto('${MSW_PROBE_ROUTE}')

  await expect(page.getByText('${EXAMPLE_API.text}')).toBeVisible()
})
`,
    )

    starter.expectNpmSuccess(['run', 'test:e2e', '--', spec], e2eEnv)
  })
})

describe('개발 서버', () => {
  test('개발 서버가 보내는 API 요청은 MSW가 받는다', async () => {
    writeMswProbePage(starter)
    const port = await freePort()
    const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir)

    try {
      const response = await waitForServer(`http://localhost:${port}${MSW_PROBE_ROUTE}`, devServer)

      expect(response.status, devServer.output()).toBe(200)
      expect(await response.text()).toContain(EXAMPLE_API.text)
    } finally {
      await devServer.stop()
    }
  })
})
