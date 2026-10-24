import { createRequire } from 'node:module'
import { join } from 'node:path'
import { createJiti } from 'jiti'
import { type Config, type ConfigExternal, generate } from 'orval'

const require = createRequire(import.meta.url)

/**
 * Starter의 orval 설정(config/orval.config.ts)대로 openapi.yaml에서 재생성 API 계층(src/shared/api/generated)을 다시 만든다(ADR-0003).
 * Starter의 `npm run api:gen`과 같은 일을 하지만, 의존성을 설치하지 않은 Starter에서도 돌도록 Generator에 담긴 orval을 쓴다.
 * Generator는 Base가 고정한 orval·prettier와 같은 버전을 고정하므로 결과가 `npm run api:gen`과 같다. 설정 파일을 읽는 jiti도
 * Base와 같은 버전이다. 버전이 어긋나면 하네스(harness/tool-versions.test.ts)가 실패한다.
 */
export async function regenerateApiLayer(target: string): Promise<void> {
  // 설정 파일이 import하는 orval을 Starter의 node_modules 대신 Generator의 orval로 찾게 한다.
  const jiti = createJiti(import.meta.url, { alias: { orval: require.resolve('orval') }, moduleCache: false })
  const configDir = join(target, 'config')
  const exported = await jiti.import<ConfigExternal>(join(configDir, 'orval.config.ts'), { default: true })
  const config: Config = typeof exported === 'function' ? await exported() : await exported
  for (const [name, project] of Object.entries(config)) {
    if (name === 'logLevel' || project === undefined || typeof project === 'string') continue
    // `orval --config`처럼 설정 안의 경로를 설정 파일의 디렉터리 기준으로 읽는다.
    await generate(project, configDir, { throwOnError: true, logLevel: 'error' })
  }
}
