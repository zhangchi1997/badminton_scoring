import { createTapHandler, adjustScore } from '../src/common/tapScore.js'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runTests() {
  let singles = 0
  let doubles = 0
  const tap = createTapHandler(
    () => {
      singles += 1
    },
    () => {
      doubles += 1
    },
    50
  )

  tap()
  await sleep(80)
  console.assert(singles === 1, 'single tap should increment once')
  console.assert(doubles === 0, 'single tap should not trigger double')

  tap()
  tap()
  await sleep(80)
  console.assert(singles === 1, 'double tap should cancel pending single')
  console.assert(doubles === 1, 'double tap should fire once')

  console.assert(adjustScore(0, -1) === 0, 'score should not go below zero')
  console.assert(adjustScore(3, -1) === 2, 'score should decrement normally')

  console.log('tapScore tests passed')
}

runTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
