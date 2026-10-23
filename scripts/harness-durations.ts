// 하네스 파일별 소요 시간 기록(harness/durations.json)을 CI 실행의 로그로 다시 만드는 기여자용 스크립트. 레포 최상위
// package.json의 harness:durations 스크립트가 부른다. CI의 Harness 묶음은 이 기록으로 하네스 파일을 나눈다
// (harness/sequencer.ts). 쓰는 법은 docs/agents/workflow.md의 "실행"에 있다.
//
//   node scripts/harness-durations.ts <실행 ID>...
//
// 실행 ID는 성공한 CI 워크플로 실행의 것이다(`gh run list --workflow ci.yml --status success`). `gh run view --log`로 그
// 실행의 잡 로그를 받아, Vitest 기본 리포터가 파일마다 찍는 줄(`✓ harness/<이름>.test.ts (N tests) <밀리초>ms`)에서 시간을
// 읽는다. 실행을 여러 개 주면 파일마다 평균을 쓴다. 러너마다 시간이 1~2할씩 흔들리므로 둘 이상을 주는 편이 낫다.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DURATIONS_FILE, type DurationRecord } from '../harness/sequencer.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..')

// 터미널이 아닌 곳(CI)에서도 Vitest가 색을 넣으므로 지우고 읽는다.
const ANSI_COLOR = /\x1b\[[0-9;]*m/g
const FILE_RESULT = /✓\s+(?:\S+\s+)?(harness\/\S+\.test\.ts) \(\d+ tests?[^)]*\)\s+(\d+)ms\s*$/

const runs = process.argv.slice(2)
if (runs.length === 0 || runs.some((run) => !/^\d+$/.test(run))) {
  console.error('사용법: node scripts/harness-durations.ts <실행 ID>...')
  process.exit(1)
}

const observed = new Map<string, number[]>()
for (const run of runs) {
  const { conclusion } = JSON.parse(gh(['run', 'view', run, '--json', 'conclusion'])) as { conclusion: string }
  // 실패한 테스트 파일은 일찍 끝나 시간이 짧게 잡히므로 모두 통과한 실행만 쓴다.
  if (conclusion !== 'success') throw new Error(`실행 ${run}의 결과가 ${conclusion || '아직 없음'}입니다. 성공한 실행을 주세요.`)
  let found = 0
  for (const line of gh(['run', 'view', run, '--log']).split('\n')) {
    const match = FILE_RESULT.exec(line.replace(ANSI_COLOR, ''))
    if (!match?.[1] || !match[2]) continue
    observed.set(match[1], [...(observed.get(match[1]) ?? []), Number(match[2])])
    found++
  }
  if (found === 0) {
    throw new Error(`실행 ${run}의 로그에서 하네스 파일의 시간을 찾지 못했습니다. Vitest 기본 리포터의 출력 형식이 바뀌었는지 보세요.`)
  }
  console.log(`실행 ${run}: 하네스 파일 ${String(found)}개의 시간을 읽었습니다.`)
}

// 지금 레포에 없는 파일(지우거나 이름을 바꾼 파일)은 기록하지 않는다.
const seconds = Object.fromEntries(
  [...observed]
    .filter(([file]) => existsSync(join(REPO_ROOT, file)))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([file, ms]) => [file, Math.round(ms.reduce((sum, m) => sum + m, 0) / ms.length / 1000)]),
)
const record: DurationRecord = { runs: runs.map(Number), seconds }
writeFileSync(join(REPO_ROOT, DURATIONS_FILE), `${JSON.stringify(record, null, 2)}\n`)
console.log(`${DURATIONS_FILE}에 하네스 파일 ${String(Object.keys(seconds).length)}개의 시간을 기록했습니다.`)

const missing = readdirSync(join(REPO_ROOT, 'harness'))
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => `harness/${name}`)
  .filter((file) => !(file in seconds))
if (missing.length > 0) {
  console.log(`기록에 없는 하네스 파일(기록된 시간의 중앙값으로 나눕니다): ${missing.join(', ')}`)
}

/** gh를 실행하고 표준 출력을 돌려준다. 실패하면 출력과 함께 오류를 던진다. */
function gh(args: readonly string[]): string {
  // 실행 하나의 로그가 수 MB이므로 출력 한도를 넉넉히 둔다.
  const result = spawnSync('gh', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')}이(가) 실패했습니다.\n${result.stdout}${result.stderr}`)
  return result.stdout
}
