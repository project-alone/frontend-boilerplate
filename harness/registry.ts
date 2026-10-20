import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'

/**
 * packageDir의 패키지를 npm pack으로 destination에 묶고 tarball 경로를 돌려준다.
 * 라이프사이클 스크립트(prepack의 빌드)는 실행하지 않으므로 빌드가 필요하면 먼저 한다.
 */
export function packPackage(packageDir: string, destination: string): string {
  const packed = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination], {
    cwd: packageDir,
    encoding: 'utf8',
  })
  const [packedFile] = JSON.parse(packed) as { filename: string }[]
  if (packedFile === undefined) throw new Error(`npm pack 결과를 읽을 수 없습니다: ${packed}`)
  return join(destination, packedFile.filename)
}

/** 하네스가 띄운 npm 레지스트리 */
export interface PackedGeneratorRegistry {
  /** npm의 registry 설정(`npm_config_registry`)에 넣을 주소 */
  url: string
  close: () => Promise<void>
}

/**
 * npm pack으로 만든 Generator tarball을 npm에 배포된 것처럼 내주는 레지스트리를 띄운다.
 * Starter는 Generator를 npm 레지스트리의 정확한 버전으로 고정하지만 Generator는 아직 npm에 배포되지 않았다.
 * `npm_config_registry`로 이 주소를 넘기면 Starter의 `npm install`이 고정된 버전의 Generator를 이 tarball로 받는다.
 * Generator의 메타데이터와 tarball만 직접 내주고, 다른 패키지의 요청은 개발자의 npm 레지스트리로 넘긴다(리다이렉트).
 *
 * `npm install`이 이 프로세스의 서버에 요청하므로, 설치하는 명령은 이벤트 루프를 막지 않게(spawnSync가 아니라) 실행한다.
 */
export async function startPackedGeneratorRegistry(tarball: string): Promise<PackedGeneratorRegistry> {
  const upstream = execFileSync('npm', ['config', 'get', 'registry'], { encoding: 'utf8' }).trim()
  const content = readFileSync(tarball)
  const manifest = JSON.parse(
    execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8' }),
  ) as { name: string; version: string }
  const tarballPath = `/${manifest.name}/-/${manifest.name}-${manifest.version}.tgz`

  const server = createServer((request, response) => {
    const path = request.url ?? '/'
    if (path === `/${manifest.name}`) {
      const packument = {
        name: manifest.name,
        'dist-tags': { latest: manifest.version },
        versions: {
          [manifest.version]: {
            ...manifest,
            _id: `${manifest.name}@${manifest.version}`,
            dist: {
              tarball: `${url}${tarballPath.slice(1)}`,
              integrity: `sha512-${createHash('sha512').update(content).digest('base64')}`,
              shasum: createHash('sha1').update(content).digest('hex'),
            },
          },
        },
      }
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      response.end(JSON.stringify(packument))
    } else if (path === tarballPath) {
      response.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' })
      response.end(content)
    } else {
      response.writeHead(302, { location: new URL(path.slice(1), upstream).href })
      response.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('레지스트리의 포트를 알 수 없습니다.')
  const url = `http://127.0.0.1:${String(address.port)}/`

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve()
          else reject(error)
        })
      }),
  }
}
