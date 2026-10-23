import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { BaseSequencer, type TestSpecification, type Vitest } from 'vitest/node'

/** 하네스 파일별 소요 시간 기록(레포 최상위 기준). `scripts/harness-durations.ts`가 CI 실행의 로그로 만든다. */
export const DURATIONS_FILE = 'harness/durations.json'

export interface DurationRecord {
  /** 시간을 잰 GitHub Actions 실행의 ID */
  runs: number[]
  /** 레포 최상위 기준 파일 경로(`harness/<이름>.test.ts`)마다 걸린 시간(초) */
  seconds: Record<string, number>
}

// CI는 하네스 파일을 `--shard`로 다섯 묶음으로 나눠 러너 다섯 대에서 돌린다. Vitest의 BaseSequencer는 파일 경로의 해시
// 순서로 파일 수만 같게 나누므로 묶음마다 걸리는 시간이 10분에서 17분까지 벌어졌다(#108). 이 sequencer는 커밋된 기록의
// 파일별 시간으로 묶음을 고르게 나누고, 묶음 안에서도 오래 걸리는 파일부터 돌린다.
export class DurationSequencer extends BaseSequencer {
  readonly #seconds: (spec: TestSpecification) => number

  constructor(ctx: Vitest) {
    super(ctx)
    this.#seconds = readDurations(ctx.config.root)
  }

  // 묶음마다 따로 뜬 Vitest가 같은 파일 목록과 커밋된 기록으로 모든 묶음의 나눔을 똑같이 계산하고 자기 묶음만 고른다. 그래서
  // 어느 파일도 빠지거나 두 묶음에서 돌지 않는다. Vitest 캐시(지난 실행의 결과)는 실행마다, 묶음마다 다르므로 쓰지 않는다.
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { shard, root } = this.ctx.config
    if (!shard) return files
    const seconds = this.#seconds

    // 긴 파일부터, 지금까지 더한 시간이 가장 짧은 묶음에 넣는다. 받은 파일 순서와 상관없이 같은 결과가 나오도록 시간이 같은
    // 파일은 경로와 프로젝트 이름으로, 시간이 같은 묶음은 파일 수와 번호로 고른다.
    const shards = Array.from({ length: shard.count }, () => ({ seconds: 0, files: [] as TestSpecification[] }))
    for (const spec of [...files].sort((a, b) => seconds(b) - seconds(a) || compareSpecs(a, b, root))) {
      const target = shards.reduce((min, s) =>
        s.seconds < min.seconds || (s.seconds === min.seconds && s.files.length < min.files.length) ? s : min,
      )
      target.seconds += seconds(spec)
      target.files.push(spec)
    }
    return shards[shard.index - 1]?.files ?? []
  }

  // CI에는 Vitest 캐시가 없어 BaseSequencer가 크기가 큰 파일부터 돌린다. 크기와 시간은 맞지 않아서, 고르게 나눈 묶음도 작고
  // 오래 걸리는 파일이 맨 뒤에 남으면 15분을 넘긴다. 그래서 BaseSequencer가 정한 프로젝트의 순서(groupOrder 등)는 두고,
  // 프로젝트 안에서는 기록된 시간이 긴 파일부터 돌린다.
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const sorted = await super.sort(files)
    const projectOrder = new Map<TestSpecification['project'], number>()
    for (const spec of sorted) if (!projectOrder.has(spec.project)) projectOrder.set(spec.project, projectOrder.size)
    const rank = (spec: TestSpecification) => projectOrder.get(spec.project) ?? 0
    return sorted.sort((a, b) => rank(a) - rank(b) || this.#seconds(b) - this.#seconds(a))
  }
}

function readDurations(root: string): (spec: TestSpecification) => number {
  const record = JSON.parse(readFileSync(join(root, DURATIONS_FILE), 'utf8')) as DurationRecord
  // 기록에 없는 파일(새로 더한 하네스 파일)은 기록된 시간의 중앙값으로 친다. 하네스 파일은 대개 Starter를 만들어 설치하고
  // 검사하므로 그쯤 걸린다.
  const recorded = Object.values(record.seconds).sort((a, b) => a - b)
  const median = recorded[Math.floor(recorded.length / 2)] ?? 0
  return (spec) => record.seconds[specPath(spec, root)] ?? median
}

function specPath(spec: TestSpecification, root: string): string {
  return relative(root, spec.moduleId).replaceAll('\\', '/')
}

function compareSpecs(a: TestSpecification, b: TestSpecification, root: string): number {
  const [pathA, pathB] = [specPath(a, root), specPath(b, root)]
  if (pathA !== pathB) return pathA < pathB ? -1 : 1
  return a.project.name < b.project.name ? -1 : a.project.name > b.project.name ? 1 : 0
}
