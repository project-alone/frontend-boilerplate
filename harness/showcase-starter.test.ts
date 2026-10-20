import { join, resolve } from 'node:path'
import { expect, inject, test } from 'vitest'
import { freePort, run } from './run.ts'
import { useStarter } from './starter.ts'

// 하네스 매트릭스의 "모든 Recipe를 켠 조합"(= Showcase). Showcase 생성 스크립트로 만든 Starter를 설치해, Starter 자신의
// 스크립트와 모든 Recipe가 함께 넣은 테스트가 한 Starter 안에서 함께 통과하는지 본다. 커밋된 apps/showcase가 이렇게
// 만든 결과와 같은지는 showcase.test.ts(와 CI의 showcase:check)가 보므로, 커밋된 Showcase도 빌드·테스트를 통과한다.

const REPO_ROOT = resolve(import.meta.dirname, '..')

const starter = useStarter({
  prefix: 'dcgen-showcase-starter-',
  create: (workdir) => {
    const out = join(workdir, 'showcase')
    const result = run('npm', ['run', 'showcase', '--', '--generator', inject('generatorDir'), '--out', out], REPO_ROOT)
    expect(result.status, result.output).toBe(0)
    return out
  },
  install: true,
  playwright: true,
})

test('Showcase는 타입 검사, 린트, 포맷 검사, 단위 테스트, 스토리 검사를 통과한다', () => {
  for (const script of [
    ['run', 'typecheck'],
    ['run', 'lint'],
    ['run', 'format:check'],
    ['test'],
    ['run', 'test:storybook'],
  ]) {
    starter.expectNpmSuccess(script)
  }
})

test('Showcase는 빌드를 통과하고, 빌드한 앱에서 모든 Recipe의 E2E가 통과한다', async () => {
  starter.expectNpmSuccess(['run', 'build'])

  starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
})
