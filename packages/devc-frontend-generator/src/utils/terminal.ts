import { indentLines } from './text.js'

// 터미널에서 실행한 dcgen의 입출력을 다루는 범용 함수

/** 사람이 터미널에서 실행했는지 본다. CI와 다른 프로그램이 실행한 경우(입출력이 터미널이 아님)는 아니다. */
export function isInteractive(): boolean {
  const ci = process.env['CI']
  const inCi = ci !== undefined && ci !== '' && ci !== 'false'
  return process.stdin.isTTY === true && process.stdout.isTTY && !inCi
}

/** 명령을 마친 뒤 사용자가 차례로 실행할 명령을 알린다. */
export function printNextSteps(steps: readonly string[]): void {
  console.log(`\n다음 단계:\n\n${indentLines(steps)}\n`)
}
