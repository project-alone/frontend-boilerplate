---
"devc-frontend-generator": minor
---

Starter 최상위에 흩어져 있던 설정 파일과 환경 변수의 타입 선언을 디렉터리로 모은다. 최상위에는 도구가 최상위에서만 찾는 `next.config.ts`, `postcss.config.mjs`, `eslint.config.ts`, `tsconfig.json`만 남는다.

- `config/`: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `orval.config.ts`, `next.config.plugins.ts`
- `types/`: `process-env.d.ts`와 Rendering Mode·Recipe가 더하는 `process-env.<이름>.d.ts`

npm 스크립트(`test`, `test:storybook`, `test:e2e`, `api:gen`)는 `--config`로 새 위치의 설정을 넘긴다. Vitest와 Playwright를 `npx`로 직접 부르면 설정을 찾지 못하므로, 파일 하나만 돌릴 때도 `npm test -- <파일>`, `npm run test:e2e -- <파일>`처럼 npm 스크립트를 쓴다. VS Code의 Vitest·Playwright 확장은 `config/`의 설정을 그대로 찾는다.

이미 만든 Starter는 옮기지 않아도 그대로 동작하고, 새 Generator의 `dcgen g`도 옮기지 않은 Starter에서 동작한다. 같은 구조로 옮기려면 다음과 같이 한다.

1. `config/`와 `types/`를 만들고 위 파일을 옮긴다(`git mv`).
2. `next.config.ts`의 `import { withPlugins } from './next.config.plugins'`를 `'./config/next.config.plugins'`로 바꾸고, `config/next.config.plugins.ts` 안의 `./src/...` import를 `../src/...`로 바꾼다.
3. `config/vitest.config.ts`: `import { join } from 'node:path'`와 `const root = join(import.meta.dirname, '..')`를 더하고, 설정에 `root`를 넣는다. `setupFiles`는 `['config/vitest.setup.ts']`로, Storybook 플러그인은 `storybookTest({ configDir: join(root, '.storybook') })`로 바꾼다.
4. `config/playwright.config.ts`: `testDir`를 `'../e2e'`로 바꾸고 `outputDir: '../test-results'`와 `webServer`의 `cwd: '..'`를 더한다.
5. `config/orval.config.ts`: `./openapi.yaml`, `./src/...`로 시작하는 경로와 `MOCK_API_BASE_URL`의 import를 `../`로 시작하게 바꾼다. orval은 경로를 설정 파일 기준으로 읽는다.
6. `package.json`의 스크립트를 `vitest run --config config/vitest.config.ts --project unit`(`test:storybook`은 `--project storybook`), `playwright test --config config/playwright.config.ts`, `orval --config config/orval.config.ts`로 바꾼다.
