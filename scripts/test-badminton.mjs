import { isGameWon } from '../src/common/badminton.js'

const cases = [
  [0, 0, false],
  [19, 21, false],
  [20, 20, false],
  [21, 19, true],
  [21, 20, false],
  [22, 20, true],
  [25, 24, false],
  [27, 25, true],
  [29, 28, false],
  [29, 30, false],
  [30, 29, true],
  [30, 28, true]
]

let failed = 0
for (const [score, opponentScore, expected] of cases) {
  const got = isGameWon(score, opponentScore)
  if (got !== expected) {
    failed += 1
    console.error(`isGameWon(${score}, ${opponentScore}) = ${got}, expected ${expected}`)
  }
}

if (failed > 0) {
  process.exit(1)
}
console.log('badminton tests passed')
