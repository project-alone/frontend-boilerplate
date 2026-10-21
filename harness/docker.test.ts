import { randomUUID } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest'
import { freePort, run, type RunResult } from './run.ts'
import { GENERATOR_PACKAGE, SAMPLE_PRODUCTS, useStarter } from './starter.ts'

test('docker Recipe는 Next.js 서버를 이미지에 담으므로 static-export Starter에는 이유와 함께 넣지 않는다', () => {
  const workdir = mkdtempSync(join(tmpdir(), 'dcgen-docker-static-'))
  try {
    const result = run(
      inject('dcgenBin'),
      ['new', 'my-app', '--rendering-mode', 'static-export', '--recipe', 'docker', '--skip-install'],
      workdir,
    )

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Recipe docker은(는) Rendering Mode static-export에서 쓸 수 없습니다')
    expect(result.output).toContain('정적 파일 서버나 CDN')
    expect(readdirSync(workdir)).toEqual([])
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
})

// 이미지 검사에는 Docker가 필요하다. 없으면 이유를 알리고 건너뛰지만, CI에서는 건너뛰지 않고 실패해 검사가 조용히 빠지지 않게 한다
// (GitHub Actions의 ubuntu-latest 러너에는 Docker가 있다).
const dockerInfo = run('docker', ['info', '--format', '{{.ServerVersion}}'], tmpdir())
const dockerMissing =
  dockerInfo.status === 0
    ? undefined
    : `Docker를 쓸 수 없어 docker Recipe의 이미지를 검사하지 않습니다(docker info: ${
        dockerInfo.status === null ? 'docker 명령이 없습니다' : dockerInfo.output.trim()
      }).`
const skipImages = dockerMissing !== undefined && !process.env['CI']
if (skipImages) console.warn(dockerMissing)

// Dockerfile을 검사하는 hadolint. 이미지의 태그로 버전을 고정한다.
const HADOLINT_IMAGE = 'hadolint/hadolint:v2.14.0'

// 하네스 매트릭스: Base에 docker Recipe를 넣은 server Starter를 만들어, Starter 자신의 스크립트와 Recipe가 함께 넣은
// 테스트(e2e/health.spec.ts)가 통과하는지 보고, Dockerfile로 이미지를 만들어 컨테이너가 HTTP 요청에 응답하는지 본다.
// 모든 Recipe를 켠 조합은 showcase-starter.test.ts가 본다.
describe('Rendering Mode server에 docker Recipe를 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-docker-',
    renderingMode: 'server',
    recipes: ['docker'],
    install: true,
    playwright: true,
  })

  test('Dockerfile은 .nvmrc와 같은 메이저 버전에 package.json의 engines를 만족하는 Node 이미지를 정확한 버전으로 고정한다', () => {
    const dockerfile = readFileSync(join(starter.dir, 'Dockerfile'), 'utf8')
    const nvmrc = readFileSync(join(starter.dir, '.nvmrc'), 'utf8').trim()
    const { engines } = JSON.parse(readFileSync(join(starter.dir, 'package.json'), 'utf8')) as {
      engines: { node: string }
    }

    const image = /^ARG NODE_IMAGE=(\S+)$/m.exec(dockerfile)?.[1] ?? ''
    const [, major, minor, patch] = /^node:(\d+)\.(\d+)\.(\d+)-[\w-]+$/.exec(image) ?? []
    expect(major, `NODE_IMAGE=${image}`).toBe(nvmrc)
    const [, engineMajor, engineMinor, enginePatch] = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(engines.node) ?? []
    expect(major).toBe(engineMajor)
    expect(Number(minor) * 1000 + Number(patch), `${image}는 engines.node ${engines.node}를 만족해야 한다`).toBeGreaterThanOrEqual(
      Number(engineMinor) * 1000 + Number(enginePatch),
    )

    // 모든 단계는 고정한 이미지나 앞에서 만든 단계에서 시작한다.
    const stages: string[] = []
    for (const [, from, stage] of dockerfile.matchAll(/^FROM (\S+)(?: AS (\S+))?$/gm)) {
      expect(['${NODE_IMAGE}', ...stages], `FROM ${from ?? ''}`).toContain(from)
      if (stage !== undefined) stages.push(stage)
    }
    expect(stages.length).toBeGreaterThan(0)
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트, 스토리 검사를 통과한다', () => {
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

  test('빌드하면 상태 확인 주소는 요청마다 응답하고, 빌드한 앱에서 E2E가 통과한다', async () => {
    const result = starter.expectNpmSuccess(['run', 'build'])
    // next build는 라우트마다 미리 렌더링했는지(○ Static) 요청마다 렌더링하는지(ƒ Dynamic) 표로 보여 준다.
    const routeLine = result.output.split('\n').find((line) => line.includes(' /api/health')) ?? ''
    expect(routeLine, result.output).toContain('ƒ')

    // list 보고서는 테스트마다 파일 이름을 적는다(CI에서 Playwright의 기본 보고서는 이름을 적지 않는 dot이다).
    const e2e = starter.expectNpmSuccess(['run', 'test:e2e', '--', '--reporter=list'], {
      E2E_PORT: String(await freePort()),
    })
    expect(e2e.output).toMatch(/✓ .*health\.spec\.ts/)
  })

  describe.skipIf(skipImages)(`Dockerfile로 만든 이미지${skipImages ? '(Docker가 없어 건너뜀)' : ''}`, () => {
    // 하네스가 만든 이미지와 컨테이너. 이름이 겹치지 않게 하고, 끝나면 이 이름의 것만 지운다.
    const name = `dcgen-harness-docker-${randomUUID().slice(0, 8)}`
    const label = `dcgen-harness=${name}`
    const deployImage = `${name}:deploy`
    const mockImage = `${name}:mock`
    const images: string[] = []
    const containers: string[] = []
    let context = ''

    // 개발자의 로컬 환경 변수 파일에 든 비밀 값. 이미지 어디에도 들어가면 안 된다.
    const LOCAL_SECRET = `harness-secret-${randomUUID()}`
    // public 파일이 이미지에 복사되어 standalone 서버가 내주는지 볼 파일
    const PUBLIC_FILE = { path: 'harness-public.txt', content: 'public 파일입니다' }

    const docker = (args: readonly string[]): RunResult => run('docker', args, tmpdir())
    const expectDockerSuccess = (args: readonly string[]): RunResult => {
      const result = docker(args)
      expect(result.status, `docker ${args.join(' ')}\n${result.output}`).toBe(0)
      return result
    }
    const build = (tag: string, args: readonly string[] = []) => {
      expectDockerSuccess(['build', '--progress=plain', '--label', label, '--tag', tag, ...args, context])
      images.push(tag)
    }

    /** 컨테이너를 띄우고 호스트에서 부를 주소를 돌려준다. 포트는 호스트의 빈 포트에 이어 다른 서버와 겹치지 않는다. */
    const startContainer = (image: string, args: readonly string[] = []) => {
      const container = `${name}-${String(containers.length + 1)}`
      expectDockerSuccess(['run', '--detach', '--name', container, '--label', label, '--publish', '127.0.0.1::3000', ...args, image])
      containers.push(container)
      const address = expectDockerSuccess(['port', container, '3000']).output.trim().split('\n')[0] ?? ''
      return { container, origin: `http://${address}` }
    }

    /** 컨테이너의 서버가 응답할 때까지 기다렸다가 첫 응답을 돌려준다. 1분 안에 응답하지 않으면 컨테이너 로그와 함께 실패한다. */
    const waitForResponse = async (container: string, url: string): Promise<Response> => {
      const deadline = Date.now() + 60_000
      while (Date.now() < deadline) {
        try {
          return await fetch(url)
        } catch {
          await setTimeout(500)
        }
      }
      throw new Error(`${url}에 연결하지 못했습니다.\n${docker(['logs', container]).output}`)
    }

    beforeAll(() => {
      if (dockerMissing !== undefined) throw new Error(dockerMissing)

      // 빌드 컨텍스트는 Starter의 사본이다. 사본에만 개발자가 둔 파일(public 파일, 로컬 환경 변수 파일)을 더한다.
      context = join(starter.workdir, 'image-context')
      cpSync(starter.dir, context, {
        recursive: true,
        // node_modules와 빌드 결과는 .dockerignore가 빼지만, 복사하는 시간을 줄이려고 처음부터 뺀다.
        filter: (source) => !['node_modules', '.next'].includes(relative(starter.dir, source).split(sep)[0] ?? ''),
      })
      withoutPackedGenerator(context)
      mkdirSync(join(context, 'public'), { recursive: true })
      writeFileSync(join(context, 'public', PUBLIC_FILE.path), PUBLIC_FILE.content)
      writeFileSync(join(context, '.env.production.local'), `HARNESS_LOCAL_SECRET=${LOCAL_SECRET}\n`)

      build(deployImage)
      build(mockImage, ['--target', 'mock'])
    })

    afterAll(() => {
      if (containers.length > 0) docker(['rm', '--force', ...containers])
      if (images.length > 0) docker(['rmi', '--force', ...images])
    })

    test('Dockerfile은 hadolint 검사를 통과한다', () => {
      expectDockerSuccess([
        'run',
        '--rm',
        '--label',
        label,
        '--volume',
        `${join(starter.dir, 'Dockerfile')}:/Dockerfile:ro`,
        HADOLINT_IMAGE,
        'hadolint',
        '/Dockerfile',
      ])
    })

    // Kubernetes의 runAsNonRoot는 이미지의 사용자가 숫자일 때만 root가 아닌지 확인할 수 있다.
    test('이미지는 root가 아닌 사용자로 실행되고, 사용자를 숫자로 적는다', () => {
      const user = expectDockerSuccess(['image', 'inspect', '--format', '{{.Config.User}}', deployImage]).output.trim()
      expect(user).toMatch(/^[1-9]\d*(?::\d+)?$/)

      const uid = expectDockerSuccess(['run', '--rm', '--label', label, '--entrypoint', 'id', deployImage, '-u'])
      expect(uid.output.trim()).not.toBe('0')
    })

    test('배포용 이미지의 컨테이너는 상태 확인 주소, 페이지, 정적 파일(.next/static, public)을 응답하고 HEALTHCHECK가 healthy가 된다', async () => {
      // 배포 환경처럼 백엔드 주소만 넣어 띄운다. 홈 페이지와 상태 확인 주소는 백엔드를 부르지 않는다.
      // 상태 확인을 기다리지 않도록 HEALTHCHECK의 명령은 그대로 두고 간격만 줄인다.
      const { container, origin } = startContainer(deployImage, [
        '--env',
        'API_BASE_URL=https://backend.example.com',
        '--health-interval',
        '1s',
      ])

      const health = await waitForResponse(container, `${origin}/api/health`)
      expect(health.status, docker(['logs', container]).output).toBe(200)
      expect(health.headers.get('cache-control')).toBe('no-store')
      expect(await health.json()).toEqual({ status: 'ok' })

      const home = await fetch(`${origin}/`)
      const html = await home.text()
      expect(home.status).toBe(200)
      expect(html).toContain('<h1>Starter</h1>')
      const asset = /"(\/_next\/static\/[^"]+\.(?:js|css))"/.exec(html)?.[1]
      expect(asset, html).toBeDefined()
      expect((await fetch(`${origin}${asset ?? ''}`)).status).toBe(200)

      const publicFile = await fetch(`${origin}/${PUBLIC_FILE.path}`)
      expect(publicFile.status).toBe(200)
      expect(await publicFile.text()).toBe(PUBLIC_FILE.content)

      expect(await healthStatus(container)).toBe('healthy')
    })

    test('백엔드 주소(API_BASE_URL) 없이 띄운 배포용 컨테이너는 요청을 처리하지 않아 상태 확인이 실패한다', async () => {
      const { container, origin } = startContainer(deployImage)

      const health = await waitForResponse(container, `${origin}/api/health`)

      expect(health.status).toBe(500)
      expect(docker(['logs', container]).output).toContain('API_BASE_URL 환경 변수가 없습니다')
    })

    test('로컬 환경 변수 파일(.env*.local)은 빌드 컨텍스트에서 빠져, 그 비밀 값이 빌드 단계에도 실행 이미지에도 없다', () => {
      // 빌드 단계가 이 파일을 받으면 next build가 읽어 브라우저 번들과 미리 렌더링한 페이지에 담을 수 있고, 빌드 캐시의 층에도 남는다.
      // 빌드 단계는 위에서 만든 층을 그대로 쓰므로 다시 빌드하지 않고 이름만 붙는다.
      const buildStage = `${name}:build-stage`
      build(buildStage, ['--target', 'build'])

      // 빌드 컨텍스트는 /app에 복사되고 standalone 서버도 /app에서 뜬다. grep은 찾으면 0, 찾지 못하면 1, 오류면 2로 끝난다.
      for (const [image, exclude] of [
        [buildStage, ['--exclude-dir=node_modules']],
        [deployImage, []],
      ] as const) {
        const found = docker(['run', '--rm', '--label', label, '--entrypoint', 'grep', image, '-rl', ...exclude, LOCAL_SECRET, '/app'])

        expect(found.output, image).toBe('')
        expect(found.status, image).toBe(1)
      }
    })

    test('목을 켠 배포용 빌드(API_MOCKING=enabled)는 거부하고 목 이미지를 만드는 방법을 알린다', () => {
      const result = docker(['build', '--progress=plain', '--build-arg', 'API_MOCKING=enabled', context])

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('배포용 이미지는 목을 끈 빌드(API_MOCKING=disabled)만 만듭니다')
      expect(result.output).toContain('docker build --target mock')
    })

    test('--target mock으로 만든 목 이미지는 백엔드 없이 MSW의 목 응답으로 페이지를 보여 준다', async () => {
      const { container, origin } = startContainer(mockImage)

      const products = await waitForResponse(container, `${origin}/products`)
      const html = await products.text()

      expect(products.status, docker(['logs', container]).output).toBe(200)
      for (const product of SAMPLE_PRODUCTS) expect(html).toContain(product.name)
    })

    /** 컨테이너의 HEALTHCHECK 상태. starting이 아닌 상태(healthy, unhealthy)가 될 때까지 1분 기다린다. */
    async function healthStatus(container: string): Promise<string> {
      const deadline = Date.now() + 60_000
      let status = ''
      while (Date.now() < deadline) {
        status = expectDockerSuccess(['inspect', '--format', '{{.State.Health.Status}}', container]).output.trim()
        if (status !== 'starting') return status
        await setTimeout(500)
      }
      return status
    }
  })
})

/**
 * 빌드 컨텍스트의 package.json과 package-lock.json에서 Starter가 고정한 Generator를 뺀다. Dockerfile은 이 두 파일만 먼저 복사해
 * npm ci로 설치하는데, 아직 npm에 없는 Generator는 하네스가 Starter 밖의 tarball로 바꿔 두었으므로(linkPackedGenerator) 이미지
 * 안에서 설치할 수 없다. Generator는 코드 생성(npm run g)에만 쓰고 빌드와 실행에는 쓰지 않는다. `npm uninstall --package-lock-only`는
 * Generator와 상관없는 선택 의존성(@emnapi 등)까지 lock에서 지워 npm ci가 실패하므로 Generator의 항목만 직접 지운다.
 */
function withoutPackedGenerator(context: string): void {
  interface Manifest {
    devDependencies?: Record<string, string>
  }
  const update = <T>(file: string, edit: (json: T) => void) => {
    const path = join(context, file)
    const json = JSON.parse(readFileSync(path, 'utf8')) as T
    edit(json)
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`)
  }
  const removeGenerator = (manifest: Manifest | undefined) => {
    expect(manifest?.devDependencies?.[GENERATOR_PACKAGE]).toBeDefined()
    delete manifest?.devDependencies?.[GENERATOR_PACKAGE]
  }

  update<Manifest>('package.json', removeGenerator)
  update<{ packages: Record<string, Manifest> }>('package-lock.json', ({ packages }) => {
    removeGenerator(packages[''])
    expect(packages[`node_modules/${GENERATOR_PACKAGE}`]).toBeDefined()
    delete packages[`node_modules/${GENERATOR_PACKAGE}`]
  })
}
