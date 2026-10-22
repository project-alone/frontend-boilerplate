import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import { run, type RunResult } from './run.ts'
import { GIT_ENV, useStarter } from './starter.ts'

// 설치가 오래 걸리므로 Starter를 한 번만 만들고 설치해 이 파일의 테스트가 함께 쓴다.
// 테스트가 넣은 파일은 테스트가 끝나면 지워서 다음 테스트에 영향을 주지 않는다.
const starter = useStarter({ prefix: 'dcgen-quality-', install: true })

/** Starter에 파일을 잠시 넣은 채로 action을 실행하고, 넣은 파일과 새로 만든 디렉터리를 지운다. */
function withFiles(files: Record<string, string>, action: () => RunResult): RunResult {
  const created: string[] = []
  try {
    for (const [file, content] of Object.entries(files)) {
      const segments = file.split('/')
      const firstMissing = segments
        .map((_, index) => join(starter.dir, ...segments.slice(0, index + 1)))
        .find((path) => !existsSync(path))
      if (firstMissing === undefined) throw new Error(`이미 있는 파일은 덮어쓰지 않습니다: ${file}`)
      created.push(firstMissing)
      mkdirSync(dirname(join(starter.dir, file)), { recursive: true })
      writeFileSync(join(starter.dir, file), content)
    }
    return action()
  } finally {
    for (const path of created.reverse()) rmSync(path, { recursive: true, force: true })
  }
}

function runWithFiles(files: Record<string, string>, script: string): RunResult {
  return withFiles(files, () => starter.npm(['run', script]))
}

test('생성 직후의 Starter는 lint와 format:check를 통과한다', () => {
  for (const script of ['lint', 'format:check']) {
    const result = starter.npm(['run', script])
    expect(result.status, `npm run ${script}\n${result.output}`).toBe(0)
  }
})

test('Starter는 Node LTS를 .nvmrc와 engines로 고정하고 지원 브라우저를 Next.js 기본 범위로 명시한다', () => {
  const pkg = JSON.parse(readFileSync(join(starter.dir, 'package.json'), 'utf8')) as {
    engines?: Record<string, string>
    browserslist?: string[]
  }

  expect(readFileSync(join(starter.dir, '.nvmrc'), 'utf8').trim()).toBe('24')
  expect(pkg.engines).toEqual({ node: '^24.11.0' })
  expect(pkg.browserslist).toEqual(['chrome 111', 'edge 111', 'firefox 111', 'safari 16.4'])
})

test.each([
  {
    violation: 'any 타입',
    rule: '@typescript-eslint/no-explicit-any',
    source: `export function parse(text: string): any {
  return JSON.parse(text)
}
`,
  },
  {
    violation: '@ts-ignore',
    rule: '@typescript-eslint/ban-ts-comment',
    source: `export function double(value: number): number {
  // @ts-ignore 문자열을 곱해도 계산되게 한다
  return value * '2'
}
`,
  },
  {
    violation: '설명 없는 @ts-expect-error',
    rule: '@typescript-eslint/ban-ts-comment',
    source: `export function double(value: number): number {
  // @ts-expect-error
  return value * '2'
}
`,
  },
  {
    violation: 'non-null assertion',
    rule: '@typescript-eslint/no-non-null-assertion',
    source: `export function first(values: string[]): string {
  return values[0]!
}
`,
  },
  {
    violation: '키보드로 쓸 수 없는 클릭 요소',
    rule: 'jsx-a11y-x/click-events-have-key-events',
    file: 'src/shared/sample/sample.tsx',
    source: `export function Choice({ onSelect }: { onSelect: () => void }) {
  return <div onClick={onSelect}>선택</div>
}
`,
  },
])('lint가 $rule 오류로 실패한다 ($violation)', ({ rule, file = 'src/shared/sample/sample.ts', source }) => {
  const result = runWithFiles({ [file]: source }, 'lint')

  expect(result.status, result.output).not.toBe(0)
  expect(result.output).toContain(rule)
})

test('설명을 단 @ts-expect-error는 lint를 통과한다', () => {
  const source = `export function double(value: number): number {
  // @ts-expect-error 문자열 곱셈이 타입 오류가 되는지 보여 주는 예시
  return value * '2'
}
`
  const result = runWithFiles({ 'src/shared/sample/sample.ts': source }, 'lint')

  expect(result.status, result.output).toBe(0)
})

test('app → features → queries → shared 방향의 import와 app 아래의 깊은 라우트는 lint를 통과한다', () => {
  const result = runWithFiles(
    {
      'src/shared/format/format-name.ts': `export function formatName(name: string): string {
  return name.trim()
}
`,
      'src/queries/user/user.keys.ts': `import { formatName } from '@/shared/format/format-name'

export const userKeys = {
  all: ['user'] as const,
  detail: (name: string) => [...userKeys.all, 'detail', formatName(name)] as const,
}
`,
      'src/features/profile/profile-name.tsx': `import { formatName } from '@/shared/format/format-name'

export function ProfileName({ name }: { name: string }) {
  return <strong>{formatName(name)}</strong>
}
`,
      'src/queries/user/user.queries.ts': `import { userKeys } from './user.keys'

export function prefetchUser(name: string): Promise<readonly string[]> {
  return Promise.resolve(userKeys.detail(name))
}
`,
      'src/features/profile/profile-card.tsx': `import { userKeys } from '@/queries/user/user.keys'
import { ProfileName } from './profile-name'

export function ProfileCard({ name }: { name: string }) {
  return (
    <section aria-label={userKeys.detail(name).join('/')}>
      <ProfileName name={name} />
    </section>
  )
}
`,
      'src/app/(main)/users/[name]/page.tsx': `import { ProfileCard } from '@/features/profile/profile-card'
import { prefetchUser } from '@/queries/user/user.queries'

export default async function UserPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  await prefetchUser(name)
  return (
    <main>
      <ProfileCard name={name} />
    </main>
  )
}
`,
    },
    'lint',
  )

  expect(result.status, result.output).toBe(0)
})

test.each([
  {
    violation: 'shared가 features를 import',
    files: {
      'src/features/greeting/greeting.tsx': `export function Greeting() {
  return <p>안녕하세요</p>
}
`,
      'src/shared/layout/header.tsx': `import { Greeting } from '@/features/greeting/greeting'

export function Header() {
  return (
    <header>
      <Greeting />
    </header>
  )
}
`,
    },
  },
  {
    violation: 'queries가 상대 경로로 features를 import',
    files: {
      'src/features/greeting/greeting-text.ts': `export const greetingText = '안녕하세요'
`,
      'src/queries/greeting/greeting.keys.ts': `import { greetingText } from '../../features/greeting/greeting-text'

export const greetingKeys = {
  all: ['greeting', greetingText] as const,
}
`,
    },
  },
  {
    violation: 'shared가 네 계층 밖의 src 파일을 거쳐 features를 import',
    files: {
      'src/features/greeting/greeting-text.ts': `export const greetingText = '안녕하세요'
`,
      'src/lib/greeting.ts': `export { greetingText } from '@/features/greeting/greeting-text'
`,
      'src/shared/layout/title.ts': `import { greetingText } from '@/lib/greeting'

export const title = greetingText
`,
    },
  },
])('import 방향을 어기면 lint가 실패한다 ($violation)', ({ files }) => {
  const result = runWithFiles(files, 'lint')

  expect(result.status, result.output).not.toBe(0)
  expect(result.output).toContain('boundaries/dependencies')
})

test('app 밖에서 src/<계층>/<이름>/<파일>보다 깊은 폴더에 파일을 두면 lint가 실패한다', () => {
  const result = runWithFiles(
    {
      'src/features/profile/parts/avatar.tsx': `export function Avatar() {
  return <span>프로필</span>
}
`,
    },
    'lint',
  )

  expect(result.status, result.output).not.toBe(0)
  expect(result.output).toContain('structure/max-folder-depth')
})

test('typecheck는 strict에 더한 엄격한 컴파일러 옵션 위반을 모두 잡는다', () => {
  const violations = [
    {
      option: 'noUncheckedIndexedAccess',
      file: 'unchecked-index.ts',
      code: 'TS2532',
      source: `export function firstLength(values: string[]): number {
  return values[0].length
}
`,
    },
    {
      option: 'exactOptionalPropertyTypes',
      file: 'exact-optional.ts',
      code: 'TS2375',
      source: `const options: { label?: string } = { label: undefined }

export default options
`,
    },
    {
      option: 'noImplicitOverride',
      file: 'implicit-override.ts',
      code: 'TS4114',
      source: `class Animal {
  sound(): string {
    return ''
  }
}

export class Dog extends Animal {
  sound(): string {
    return '멍'
  }
}
`,
    },
    {
      option: 'noPropertyAccessFromIndexSignature',
      file: 'index-signature.ts',
      code: 'TS4111',
      source: `export function mode(env: Record<string, string>): string | undefined {
  return env.MODE
}
`,
    },
    {
      option: 'noImplicitReturns',
      file: 'implicit-returns.ts',
      code: 'TS7030',
      source: `export function sign(value: number): string | undefined {
  if (value > 0) {
    return '+'
  }
}
`,
    },
    {
      option: 'noFallthroughCasesInSwitch',
      file: 'fallthrough.ts',
      code: 'TS7029',
      source: `export function label(value: number): string {
  let result = ''
  switch (value) {
    case 0:
      result = 'zero'
    case 1:
      result += 'one'
      break
  }
  return result
}
`,
    },
    {
      option: 'verbatimModuleSyntax',
      file: 'verbatim-import.ts',
      code: 'TS1484',
      source: `import { Metadata } from 'next'

export const metadata: Metadata = { title: '예시' }
`,
    },
  ]

  const result = runWithFiles(
    Object.fromEntries(violations.map(({ file, source }) => [`src/shared/strictness/${file}`, source])),
    'typecheck',
  )

  expect(result.status, result.output).not.toBe(0)
  for (const { option, file, code } of violations) {
    expect.soft(result.output, option).toMatch(new RegExp(`${file.replace('.', '\\.')}\\(\\d+,\\d+\\): error ${code}`))
  }
})

describe('커밋 훅', () => {
  const git = (...args: string[]) => run('git', args, starter.dir, GIT_ENV)

  /** 파일을 넣고 모든 변경을 스테이징해 커밋한 뒤, 커밋되지 않은 변경은 스테이징에서 내린다. */
  function commit(message: string, files: Record<string, string>): RunResult {
    return withFiles(files, () => {
      git('add', '--all')
      const result = git('commit', '--quiet', '--message', message)
      git('reset', '--quiet')
      return result
    })
  }

  beforeAll(() => {
    // Starter는 dcgen new가 만든 git 저장소이고, 설치(useStarter)하면서 lefthook이 훅을 설치한다. 다만 lefthook은 CI 환경
    // 변수가 있으면 설치할 때 훅을 설치하지 않으므로, CI에서도 훅이 돌도록 직접 설치한다. 설치 흐름은 new.test.ts가 본다.
    const installed = run('npx', ['--no', 'lefthook', 'install'], starter.dir, GIT_ENV)
    expect(installed.status, installed.output).toBe(0)

    // 생성된 Starter 전체가 훅을 통과해 첫 커밋이 되어야 한다.
    git('add', '--all')
    const initial = git('commit', '--quiet', '--message', 'chore: 프로젝트 시작')
    expect(initial.status, initial.output).toBe(0)
  })

  test('규칙을 지킨 변경은 Conventional Commits 메시지로 커밋된다', () => {
    const source = `export function formatName(name: string): string {
  return name.trim()
}
`
    const result = commit('feat: 이름 서식 함수 추가', { 'src/shared/format/format-name.ts': source })

    expect(result.status, result.output).toBe(0)
    expect(git('log', '-1', '--format=%s').output.trim()).toBe('feat: 이름 서식 함수 추가')
  })

  test('commit-msg 훅은 Conventional Commits 형식이 아닌 메시지를 거부한다', () => {
    const source = `export function formatTitle(title: string): string {
  return title.toUpperCase()
}
`
    const result = commit('제목 서식 함수 추가', { 'src/shared/format/format-title.ts': source })

    expect(result.status, result.output).not.toBe(0)
    expect(result.output).toContain('type-empty')
  })

  test.each([
    {
      check: 'lint',
      expected: '@typescript-eslint/no-explicit-any',
      source: `export function parse(text: string): any {
  return JSON.parse(text)
}
`,
    },
    {
      check: '포맷',
      expected: 'src/shared/sample/sample.ts',
      source: `export const greeting = "안녕하세요";
`,
    },
    {
      check: '타입 검사',
      expected: 'TS2322',
      source: `export function count(): number {
  return '하나'
}
`,
    },
  ])('pre-commit 훅은 검사에 실패한 변경의 커밋을 막는다 ($check)', ({ expected, source }) => {
    const result = commit('feat: 샘플 추가', { 'src/shared/sample/sample.ts': source })

    expect(result.status, result.output).not.toBe(0)
    expect(result.output).toContain(expected)
  })
})
