import { spawnSync } from 'node:child_process'

export interface RunResult {
  status: number | null
  output: string
}

export function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env: Record<string, string> = {},
): RunResult {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}
