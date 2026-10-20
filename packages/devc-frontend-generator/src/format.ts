import { format, resolveConfig } from 'prettier'

/**
 * Generator가 Starter에 쓰는 파일(병합한 명세, 확장 지점을 조립한 파일)을 Starter의 Prettier 설정으로 맞춘다. Starter의
 * `format:check`를 그대로 통과하도록 Base가 고정한 것과 같은 버전의 Prettier를 쓴다(harness/tool-versions.test.ts가 확인한다).
 */
export async function formatForStarter(path: string, content: string): Promise<string> {
  // `prettier --check`(Starter의 format:check)와 같은 방법으로 설정을 찾는다.
  const options = await resolveConfig(path, { editorconfig: true })
  return format(content, { ...options, filepath: path })
}
