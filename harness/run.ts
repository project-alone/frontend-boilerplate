import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout } from 'node:timers/promises'

export interface RunResult {
  status: number | null
  output: string
}

export function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
): RunResult {
  const result = spawnSync(command, args, { cwd, env: { ...envWithoutVitest(), ...env }, encoding: 'utf8' })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

export interface BackgroundProcess {
  output: () => string
  stop: () => Promise<void>
}

// 개발 서버처럼 스스로 끝나지 않는 명령을 띄운다. `stop`은 명령이 띄운 자식 프로세스까지 함께 끝낸다.
export function start(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
): BackgroundProcess {
  const child = spawn(command, args, { cwd, env: { ...envWithoutVitest(), ...env }, detached: true })
  let output = ''
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))

  return {
    output: () => output,
    stop: async () => {
      const running = child.exitCode === null && child.signalCode === null
      if (running && child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
      await exited
    },
  }
}

// 띄운 서버가 응답할 때까지 기다렸다가 첫 응답을 돌려준다. 2분 안에 연결되지 않으면 서버 출력과 함께 실패한다.
export async function waitForServer(url: string, server: BackgroundProcess): Promise<Response> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      return await fetch(url)
    } catch {
      await setTimeout(500)
    }
  }
  throw new Error(`${url}에 연결하지 못했습니다.\n${server.output()}`)
}

// 다른 프로세스(예: 다른 워크트리에서 도는 하네스)가 쓰지 않는 포트를 고른다.
// 이미 떠 있는 엉뚱한 서버를 대상으로 검사하는 일을 막는다.
export async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (address === null || typeof address === 'string') throw new Error('빈 포트를 찾지 못했습니다.')
  return address.port
}

// Vitest가 하네스 프로세스에 넣는 환경 변수. 명령은 개발자의 셸처럼 이 값들 없이 실행한다.
// 예를 들어 NODE_ENV=test가 남아 있으면 `next dev`가 .env.development 대신 .env.test를 읽는다.
// 나머지도 하네스의 Vitest가 넣은 값이므로, Starter 안에서 다시 뜨는 Vitest·Storybook에 섞이지 않게 함께 뺀다.
const VITEST_ENV_KEYS = [
  'NODE_ENV',
  'TEST',
  'VITEST',
  'VITEST_MODE',
  'VITEST_POOL_ID',
  'VITEST_WORKER_ID',
  'BASE_URL',
  'MODE',
  'DEV',
  'PROD',
  'SSR',
]

function envWithoutVitest(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of VITEST_ENV_KEYS) delete env[key]
  return env
}
