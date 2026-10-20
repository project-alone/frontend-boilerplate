import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { freePort, start, waitForServer } from './run.ts'
import { runPlaywrightAgainst, useStarter } from './starter.ts'

// Base가 갖춘 공통 UI 컴포넌트. 컴포넌트마다 src/shared/ui/<이름>.stories.tsx 스토리가 있다.
const COMPONENTS = ['button', 'field', 'input', 'select', 'checkbox', 'dialog', 'toast']

// 디자이너가 넘겨준 새 토큰 값을 흉내 낸다. 이름공간마다 모든 토큰을 같은 값으로 바꿔서,
// 컴포넌트가 어떤 토큰을 쓰든 토큰 밖의 값을 쓰면 드러나게 한다.
const TOKENS_FILE = 'src/shared/ui/tokens.css'
const DESIGNER_TOKENS = [
  { namespace: '색', pattern: /(--color-[\w-]+):[^;]+;/g, value: '#0a141e' },
  { namespace: '글자 크기', pattern: /(--text-[a-z0-9]+):[^;]+;/g, value: '19px' },
  { namespace: '글꼴', pattern: /(--font-sans):[^;]+;/g, value: 'serif' },
  { namespace: '간격', pattern: /(--spacing):[^;]+;/g, value: '3px' },
  { namespace: '반경', pattern: /(--radius-[\w-]+):[^;]+;/g, value: '7px' },
]
// 위 토큰 값을 브라우저가 계산한 스타일로 적은 것
const DESIGNER_STYLE = { color: 'rgb(10, 20, 30)', fontSize: '19px', fontFamily: 'serif', spacing: 3, radius: '7px' }

// Starter 하나를 만들어 설치해 두고, 테스트마다 다시 설치하지 않도록 모든 테스트가 함께 쓴다.
const starter = useStarter({ prefix: 'dcgen-shared-ui-', install: true, playwright: true })

// 공통 컴포넌트를 모두 쓰는 페이지. 화면 코드가 서버 컴포넌트에서 공통 컴포넌트를 가져다 쓰는 상황을 흉내 낸다.
// 마지막 문단은 Tailwind 기본 팔레트의 유틸리티를 쓴다. 기본 팔레트를 지웠으므로 아무 스타일도 생기지 않아야 한다.
const UI_ROUTE = '/harness-ui'
const UI_PAGE = {
  [`src/app${UI_ROUTE}/page.tsx`]: `import { Button, buttonVariants } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogClose, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { ToastButton } from './toast-button'

export default function HarnessUiPage() {
  return (
    <main className="flex flex-col items-start gap-4 p-6">
      <h1 className="text-lg font-semibold">공통 UI</h1>
      <div className="flex gap-2">
        <Button type="submit">저장</Button>
        <Button variant="secondary">취소</Button>
        <Button variant="danger" size="sm">
          삭제
        </Button>
        <Button disabled>보내는 중</Button>
        <a href="https://example.com/help" className={buttonVariants({ variant: 'secondary' })}>
          도움말
        </a>
      </div>
      <Field>
        <FieldLabel>이름</FieldLabel>
        <Input placeholder="홍길동" />
        <FieldDescription>실명을 적어 주세요.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>
          <Checkbox defaultChecked />
          약관에 동의합니다
        </FieldLabel>
      </Field>
      <Select
        label="지역"
        placeholder="지역을 고르세요"
        options={[
          { value: 'seoul', label: '서울' },
          { value: 'busan', label: '부산' },
        ]}
      />
      <Dialog>
        <DialogTrigger render={<Button variant="secondary" />}>대화상자 열기</DialogTrigger>
        <DialogPopup>
          <DialogTitle>대화상자</DialogTitle>
          <DialogDescription>공통 대화상자입니다.</DialogDescription>
          <DialogClose render={<Button />}>확인</DialogClose>
        </DialogPopup>
      </Dialog>
      <ToastButton />
      <p className="rounded-xl bg-red-500 text-2xl text-white shadow-lg">Tailwind 기본 팔레트를 쓴 문단</p>
    </main>
  )
}
`,
  [`src/app${UI_ROUTE}/toast-button.tsx`]: `'use client'

import { Button } from '@/shared/ui/button'
import { useToast } from '@/shared/ui/toast'

export function ToastButton() {
  const toast = useToast()
  return (
    <Button variant="secondary" onClick={() => toast.add({ title: '저장했습니다', description: '변경한 내용이 반영되었습니다.' })}>
      알림 띄우기
    </Button>
  )
}
`,
}

// 공통 컴포넌트가 그려지는 상태(처음 화면, 선택 목록·대화상자·알림을 연 상태)를 차례로 만들며 상태마다 check를 실행한다.
// 접근성 E2E와 토큰 E2E가 같은 코드를 쓴다.
const VISIT_UI_STATES_SOURCE = `async function visitUiStates(page: Page, check: () => Promise<void>) {
  await page.goto('${UI_ROUTE}')
  await check()

  await page.getByRole('combobox', { name: '지역' }).click()
  await expect(page.getByRole('option', { name: '부산' })).toBeVisible()
  await check()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: '대화상자 열기' }).click()
  await expect(page.getByRole('dialog', { name: '대화상자' })).toBeVisible()
  await check()
  await page.keyboard.press('Escape')

  // 알림에 마우스를 올려 알림 영역을 펼치면 닫기 버튼까지 보인다.
  await page.getByRole('button', { name: '알림 띄우기' }).click()
  await page.getByRole('region', { name: '알림' }).getByText('저장했습니다').hover()
  await expect(page.getByRole('button', { name: '닫기' })).toBeVisible()
  await check()
}`

// 브라우저에서 실행하는 검사. root와 그 안의 요소마다 계산된 스타일이 디자이너의 토큰 값만 쓰는지 보고,
// 어긋난 것을 모아 돌려준다. E2E 테스트와 Storybook 스토리에 같은 코드를 넣는다.
const OFF_TOKEN_STYLES_SOURCE = `function offTokenStyles(root: Element): string[] {
  const design = ${JSON.stringify(DESIGNER_STYLE)}
  const transparent = 'rgba(0, 0, 0, 0)'
  const problems: string[] = []
  for (const element of [root, ...root.querySelectorAll('*')]) {
    const style = getComputedStyle(element)
    // 개발 서버가 띄우는 Next.js 오버레이는 앱 화면이 아니다.
    if (style.display === 'none' || element.closest('nextjs-portal')) continue
    const name = \`<\${element.tagName.toLowerCase()} class="\${element.getAttribute('class') ?? ''}">\`
    const checkValue = (property: string, allowed: (value: string) => boolean) => {
      const value = style.getPropertyValue(property)
      if (!allowed(value)) problems.push(\`\${name} \${property}: \${value}\`)
    }
    checkValue('color', (value) => value === design.color)
    checkValue('background-color', (value) => value === design.color || value === transparent)
    for (const side of ['top', 'right', 'bottom', 'left']) {
      if (style.getPropertyValue(\`border-\${side}-style\`) === 'none') continue
      checkValue(\`border-\${side}-color\`, (value) => value === design.color)
    }
    if (style.outlineStyle !== 'none') checkValue('outline-color', (value) => value === design.color)
    checkValue('box-shadow', (value) => (value.match(/rgba?\\([^)]*\\)/g) ?? []).every((color) => color === design.color))
    for (const corner of ['top-left', 'top-right', 'bottom-right', 'bottom-left']) {
      checkValue(\`border-\${corner}-radius\`, (value) => value === '0px' || value === design.radius)
    }
    checkValue('font-size', (value) => value === design.fontSize)
    checkValue('font-family', (value) => value === design.fontFamily)
    for (const property of ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'row-gap', 'column-gap']) {
      checkValue(property, (value) => {
        const steps = Number.parseFloat(value) / design.spacing
        return Number.isNaN(steps) || Math.abs(steps - Math.round(steps)) < 0.01
      })
    }
  }
  return problems
}`

beforeAll(() => {
  for (const [path, content] of Object.entries(UI_PAGE)) starter.writeFile(path, content)
})

describe('공통 UI 컴포넌트', () => {
  test('컴포넌트마다 스토리가 있고, 모든 스토리가 접근성(axe)·상호작용 검사를 통과한다', () => {
    const report = join(starter.workdir, 'storybook-report.json')
    starter.expectNpmSuccess([
      'run',
      'test:storybook',
      '--',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${report}`,
    ])

    const { testResults } = JSON.parse(readFileSync(report, 'utf8')) as {
      testResults: { name: string; status: string; assertionResults: unknown[] }[]
    }
    for (const component of COMPONENTS) {
      const file = testResults.find(({ name }) => name.endsWith(`/src/shared/ui/${component}.stories.tsx`))
      expect.soft(file, `${component} 스토리`).toMatchObject({ status: 'passed' })
      expect.soft(file?.assertionResults.length ?? 0, `${component} 스토리 수`).toBeGreaterThan(0)
    }
  })

  describe('공통 컴포넌트를 쓰는 페이지', () => {
    test('타입 검사, 린트, 빌드를 통과한다', () => {
      starter.expectNpmSuccess(['run', 'typecheck'])
      starter.expectNpmSuccess(['run', 'lint'])
      starter.expectNpmSuccess(['run', 'build'])
    })

    test('빌드된 페이지는 팝업을 연 상태까지 WCAG 2.2 AA 위반이 없다', async () => {
      const spec = 'e2e/harness-ui.spec.ts'
      starter.writeFile(
        spec,
        `import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

${VISIT_UI_STATES_SOURCE}

test('공통 컴포넌트를 쓴 페이지', async ({ page }) => {
  await visitUiStates(page, async () => {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
    expect(violations).toEqual([])
  })
})
`,
      )

      starter.expectNpmSuccess(['run', 'test:e2e', '--', spec], { E2E_PORT: String(await freePort()) })
    })
  })
})

describe('디자이너가 토큰 파일의 값만 바꾸면', () => {
  let originalTokens: string

  const TOKENS_SPEC = 'e2e/harness-tokens.spec.ts'
  const TOKENS_SPEC_SOURCE = `import { expect, test, type Page } from '@playwright/test'

${OFF_TOKEN_STYLES_SOURCE}

${VISIT_UI_STATES_SOURCE}

test('공통 컴포넌트는 디자이너의 토큰 값만 쓴다', async ({ page }) => {
  await visitUiStates(page, async () => {
    expect(await page.locator('body').evaluate(offTokenStyles)).toEqual([])
  })
})
`

  beforeAll(() => {
    const tokensPath = join(starter.dir, TOKENS_FILE)
    originalTokens = readFileSync(tokensPath, 'utf8')
    let tokens = originalTokens
    for (const { namespace, pattern, value } of DESIGNER_TOKENS) {
      expect(tokens.match(pattern)?.length ?? 0, `${namespace} 토큰`).toBeGreaterThan(0)
      tokens = tokens.replace(pattern, `$1: ${value};`)
    }
    writeFileSync(tokensPath, tokens)
    starter.writeFile(TOKENS_SPEC, TOKENS_SPEC_SOURCE)
  })

  afterAll(() => {
    writeFileSync(join(starter.dir, TOKENS_FILE), originalTokens)
  })

  test('빌드된 앱의 공통 컴포넌트가 바뀐 토큰 값을 따른다', async () => {
    starter.expectNpmSuccess(['run', 'build'])

    starter.expectNpmSuccess(['run', 'test:e2e', '--', TOKENS_SPEC], { E2E_PORT: String(await freePort()) })
  })

  test('개발 서버의 공통 컴포넌트가 바뀐 토큰 값을 따른다', async () => {
    const port = await freePort()
    const baseURL = `http://localhost:${port}`
    const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir)

    try {
      const response = await waitForServer(`${baseURL}${UI_ROUTE}`, devServer)
      expect(response.status, devServer.output()).toBe(200)

      // 빌드 결과 대신 이미 떠 있는 개발 서버를 검사한다.
      const result = runPlaywrightAgainst(starter.dir, baseURL, [TOKENS_SPEC])
      expect(result.status, `${result.output}\n${devServer.output()}`).toBe(0)
    } finally {
      await devServer.stop()
    }
  })

  test('Storybook의 공통 컴포넌트가 바뀐 토큰 값을 따른다', () => {
    const story = `src/app${UI_ROUTE}/page.stories.tsx`
    starter.writeFile(
      story,
      `import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import HarnessUiPage from './page'

${OFF_TOKEN_STYLES_SOURCE}

const meta = {
  component: HarnessUiPage,
  // 모든 색을 한 값으로 바꿨으므로 명도 대비 검사는 이 스토리에서 끈다.
  parameters: { a11y: { test: 'off' } },
} satisfies Meta<typeof HarnessUiPage>

export default meta

export const Default: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    await expect(offTokenStyles(canvasElement)).toEqual([])
  },
}
`,
    )

    try {
      starter.expectNpmSuccess(['run', 'test:storybook', '--', story])
    } finally {
      rmSync(join(starter.dir, story))
    }
  })
})

test('Starter는 특정 디자인 시스템의 패키지나 설정을 가져오지 않는다', () => {
  const pkg = JSON.parse(readFileSync(join(starter.dir, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  const designSystems = [
    /^shadcn$/,
    /^@radix-ui\//,
    /^@mui\//,
    /^@chakra-ui\//,
    /^@mantine\//,
    /^antd$/,
    /^daisyui$/,
    /^tailwindcss-animate$/,
    /^tw-animate-css$/,
  ]

  const dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  expect(dependencies.filter((name) => designSystems.some((pattern) => pattern.test(name)))).toEqual([])
  // shadcn/ui CLI가 만드는 설정 파일
  expect(existsSync(join(starter.dir, 'components.json'))).toBe(false)
})
