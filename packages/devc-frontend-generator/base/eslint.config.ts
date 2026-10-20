import { join, relative, sep } from 'node:path'
import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import type { Rule } from 'eslint'
import prettier from 'eslint-config-prettier/flat'
import boundaries from 'eslint-plugin-boundaries'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

// import 방향 순서(ADR-0005). 각 계층은 자기 자신과 뒤에 오는 계층만 import할 수 있다.
// app이 queries를 직접 쓰는 것은 서버 컴포넌트의 prefetch용이다. 용도까지는 lint로 막지 못하므로 리뷰에서 지킨다.
const LAYERS = ['app', 'features', 'queries', 'shared'] as const

// 폴더 깊이는 src/<계층>/<이름>/<파일>을 넘지 않는다(ADR-0005).
const MAX_DEPTH_UNDER_SRC = 3

const maxFolderDepth: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'src/<계층>/<이름>/<파일>보다 깊은 폴더에 파일을 두지 못하게 한다' },
    messages: {
      tooDeep:
        '파일은 src/<계층>/<이름>/<파일>보다 깊은 폴더에 둘 수 없습니다(ADR-0005). 하위 폴더 대신 파일 이름으로 나누거나 새 <이름>을 만드세요.',
    },
    schema: [],
  },
  create(context) {
    const depth = relative(join(import.meta.dirname, 'src'), context.filename).split(sep).length
    if (depth <= MAX_DEPTH_UNDER_SRC) return {}
    return {
      Program(node) {
        context.report({ node, messageId: 'tooDeep' })
      },
    }
  },
}

export default defineConfig(
  // 빌드·테스트 도구가 만드는 파일. ESLint는 .gitignore를 읽지 않으므로 여기에 따로 적는다.
  globalIgnores([
    '.next/',
    'out/',
    'coverage/',
    'next-env.d.ts',
    'test-results/',
    'playwright-report/',
    'storybook-static/',
    // 재생성 API 계층(npm run api:gen의 결과). 손으로 고치지 않으므로 린트하지 않는다(ADR-0003).
    'src/shared/api/generated/',
    // MSW CLI가 만드는 브라우저용 서비스 워커(Rendering Mode static-export). 손으로 고치지 않는다.
    'public/mockServiceWorker.js',
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // eslint-plugin-jsx-a11y는 ESLint 10을 지원하지 않아, 같은 규칙을 이어 관리하는 포크(eslint-plugin-jsx-a11y-x)를 쓴다.
  // 규칙 이름의 접두사는 jsx-a11y-x/이다.
  jsxA11y.configs.strict,
  // React Compiler를 쓰지 않으므로 recommended의 Compiler용 규칙은 빼고 훅 규칙 두 가지만 켠다.
  {
    ...reactHooks.configs.flat.recommended,
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  nextPlugin.configs['core-web-vitals'],
  // 팀 기준에서 금지한 것들. 위 프리셋에도 들어 있지만 기준이 드러나도록 다시 적는다.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
  // 계층 사이의 import는 LAYERS 순서대로 한 방향만 허용한다. 네 계층 밖의 src 파일을 거쳐 돌아가지 못하도록 그런 파일의 import도 막는다.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'features', pattern: 'src/features/*' },
        { type: 'queries', pattern: 'src/queries/*' },
        { type: 'shared', pattern: 'src/shared/*' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkUnknownLocals: true,
          message: `import 방향 위반: {{ from.element.types.[0] }} 계층에서 '{{ dependency.source }}'. 허용 방향은 ${LAYERS.join(' → ')}이고, 네 계층 밖의 src 파일은 import할 수 없습니다(ADR-0005).`,
          policies: LAYERS.map((layer, index) => ({
            from: { element: { type: layer } },
            allow: { to: { element: { types: { anyOf: LAYERS.slice(index) } } } },
          })),
        },
      ],
    },
  },
  // app은 Next.js 라우트 구조가 폴더 깊이를 정하므로 깊이 제한에서 뺀다.
  // ADR-0005가 이름을 붙인 재생성 API 계층(src/shared/api/generated)도 생성 도구가 구조를 정하므로 뺀다.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/**', 'src/shared/api/generated/**'],
    plugins: { structure: { rules: { 'max-folder-depth': maxFolderDepth } } },
    rules: { 'structure/max-folder-depth': 'error' },
  },
  // 포맷은 Prettier만 맡는다. 포맷과 겹치는 규칙을 끄므로 항상 마지막에 둔다.
  prettier,
)
