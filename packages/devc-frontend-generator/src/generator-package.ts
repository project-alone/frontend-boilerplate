import { readFileSync } from 'node:fs'

/** Generator 자신의 package.json에 적힌 이름과 버전 */
export const generatorPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  version: string
}
