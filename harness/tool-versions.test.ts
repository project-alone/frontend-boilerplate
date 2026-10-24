import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'

// Generator와 Base가 따로 고정한 도구의 버전이 같은지 본다(docs/release.md의 "의존성 버전 올리기", ADR-0010).
// Generator는 Starter를 만들 때 Base가 고정한 도구 일부를 Starter의 파일에 직접 실행하고, Starter는 같은 도구를 자기 스크립트로
// 다시 실행한다. 한쪽만 올리면 생성 직후의 Starter가 자기 검사(npm run api:gen의 결과, format:check)와 어긋날 수 있으므로
// 함께 올리게 한다. Starter를 만들지 않고 레포의 두 package.json만 읽는다.

const GENERATOR_DIR = resolve(import.meta.dirname, '../packages/devc-frontend-generator')

/**
 * Generator가 Starter를 만들 때 Starter의 파일에 실행하는 도구. Base도 같은 도구를 고정한다. Generator가 Starter의 파일에
 * 새 도구를 실행하게 되면 여기와 docs/release.md의 표에 더한다. Schematic(`dcgen g`)은 Starter에 설치된 Prettier를 쓰므로
 * 여기에 들지 않는다.
 */
const TOOLS_RUN_ON_STARTER_FILES = [
  // 명세 조각을 병합한 openapi.yaml로 재생성 API 계층을 만든다(src/api-layer.ts). Starter의 npm run api:gen과 같다.
  'orval',
  // 그때 Starter의 config/orval.config.ts를 읽어 실행한다(src/api-layer.ts). Base에서는 ESLint가 eslint.config.ts를 읽는 데 쓴다.
  'jiti',
  // 병합한 명세와 확장 지점의 조립 파일을 Starter의 설정으로 포맷한다(src/format.ts). Starter의 format:check를 통과해야 한다.
  'prettier',
]

// ^, ~, 범위 없는 정확한 버전(예: 3.9.10, 1.0.0-rc.1)
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson
}

const generator = readPackageJson(join(GENERATOR_DIR, 'package.json')).dependencies ?? {}
const basePackage = readPackageJson(join(GENERATOR_DIR, 'base', 'package.json'))
const base = { ...basePackage.dependencies, ...basePackage.devDependencies }

test.each(TOOLS_RUN_ON_STARTER_FILES)(
  'Generator는 Starter의 파일에 실행하는 도구 %s의 버전을 Base와 같은 정확한 버전으로 고정한다',
  (tool) => {
    expect(generator[tool], `Generator의 dependencies에 ${tool} 항목이 없습니다.`).toBeDefined()
    expect(base[tool], `Base의 package.json에 ${tool} 항목이 없습니다.`).toBeDefined()
    expect(generator[tool], `Generator의 ${tool}`).toMatch(EXACT_VERSION)
    expect(
      generator[tool],
      `Generator(${String(generator[tool])})와 Base(${String(base[tool])})의 ${tool} 버전이 다릅니다. ` +
        '두 package.json을 같은 버전으로 함께 올리세요(docs/release.md의 "의존성 버전 올리기").',
    ).toBe(base[tool])
  },
)

// 위 목록 밖이라도 Generator가 실행할 때 쓰는 패키지(dependencies)를 Base도 가졌다면, Starter에 하나로 설치되도록 같은 버전이어야 한다.
test('Generator와 Base가 함께 의존하는 다른 패키지도 같은 버전이다', () => {
  const shared = Object.keys(generator).filter((name) => name in base && !TOOLS_RUN_ON_STARTER_FILES.includes(name))

  for (const name of shared) {
    expect(
      generator[name],
      `Generator(${String(generator[name])})와 Base(${String(base[name])})의 ${name} 버전이 다릅니다.`,
    ).toBe(base[name])
  }
})

// Storybook을 더할 때(dcgen g story) Starter에 더하는 의존성은 base/storybook/package.json에 따로 고정한다(ADR-0014).
// Vitest의 브라우저 provider는 Vitest와 같은 버전이어야 하므로, Base의 vitest를 올리면 함께 올린다.
test('Storybook을 더할 때 넣는 Vitest 브라우저 provider는 Base의 vitest와 같은 버전이다', () => {
  const storybook = readPackageJson(join(GENERATOR_DIR, 'base', 'storybook', 'package.json')).devDependencies ?? {}

  expect(base['vitest']).toBeDefined()
  expect(
    storybook['@vitest/browser-playwright'],
    `base/storybook/package.json의 @vitest/browser-playwright(${String(storybook['@vitest/browser-playwright'])})와 Base의 vitest(${String(base['vitest'])}) 버전이 다릅니다.`,
  ).toBe(base['vitest'])
  for (const version of Object.values(storybook)) expect(version).toMatch(EXACT_VERSION)
})

