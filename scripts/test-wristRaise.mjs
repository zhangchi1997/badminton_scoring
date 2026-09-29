import { createWristRaiseDetector } from '../src/common/wristRaise.js'

const G = 9.81
const STEP_MS = 60

function check(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

// ratio = |gz|/|g|：0 ≈ 表盘竖直（垂手），1 ≈ 表盘水平朝上（观看）
function feedRatio(detector, ratio, timestamp, fires) {
  const gz = ratio * G
  const gx = Math.sqrt(G * G - gz * gz)
  if (detector.feed(gx, 0, gz, timestamp)) {
    fires.push(timestamp)
  }
}

/**
 * steps: { type: 'hold', ratio, fromMs, toMs }
 *      | { type: 'ramp', fromRatio, toRatio, fromMs, toMs }
 *      | { type: 'wild', magnitude, fromMs, toMs }   // 幅值超标的干扰样本
 */
function runGesture(steps, existingDetector) {
  const detector = existingDetector || createWristRaiseDetector({})
  const fires = []
  for (const step of steps) {
    for (let t = step.fromMs; t <= step.toMs; t += STEP_MS) {
      if (step.type === 'hold') {
        feedRatio(detector, step.ratio, t, fires)
      } else if (step.type === 'ramp') {
        const k = (t - step.fromMs) / (step.toMs - step.fromMs)
        feedRatio(detector, step.fromRatio + (step.toRatio - step.fromRatio) * k, t, fires)
      } else if (step.type === 'wild') {
        detector.feed(step.magnitude, step.magnitude, step.magnitude, t)
      }
    }
  }
  return { detector, fires }
}

function runTests() {
  // 1. 持续垂手不应触发
  let { fires } = runGesture([{ type: 'hold', ratio: 0.05, fromMs: 0, toMs: 1000 }])
  check(fires.length === 0, '垂手静止不应触发抬腕')

  // 2. 垂手后抬腕：触发一次，且在过渡窗口内
  const gesture = runGesture([
    { type: 'hold', ratio: 0.05, fromMs: 0, toMs: 1000 },
    { type: 'ramp', fromRatio: 0.05, toRatio: 0.9, fromMs: 1000, toMs: 1400 },
    { type: 'hold', ratio: 0.9, fromMs: 1400, toMs: 1900 }
  ])
  check(gesture.fires.length === 1, `抬腕动作应恰好触发一次，实际 ${gesture.fires.length} 次`)
  check(gesture.fires[0] > 1000 && gesture.fires[0] <= 1700, `触发应发生在抬腕过渡期内，实际 ${gesture.fires[0]}ms`)

  // 3. 冷却期内不重复触发；冷却结束后新的垂手→抬腕可再次触发
  const cooldown = runGesture([
    { type: 'hold', ratio: 0.05, fromMs: 2200, toMs: 2260 },
    { type: 'ramp', fromRatio: 0.05, toRatio: 0.9, fromMs: 2260, toMs: 2560 },
    { type: 'hold', ratio: 0.9, fromMs: 2560, toMs: 3400 }
  ], gesture.detector)
  check(cooldown.fires.length === 0, '冷却期内不应重复触发')
  const again = runGesture([
    { type: 'hold', ratio: 0.05, fromMs: 3500, toMs: 3560 },
    { type: 'ramp', fromRatio: 0.05, toRatio: 0.9, fromMs: 3560, toMs: 3900 },
    { type: 'hold', ratio: 0.9, fromMs: 3900, toMs: 4400 }
  ], gesture.detector)
  check(again.fires.length === 1, `冷却结束后再次抬腕应触发，实际 ${again.fires.length} 次`)

  // 4. 剧烈挥拍样本（线性加速度为主）被幅值门限滤掉；随后恢复正常抬腕检测
  const swing = runGesture([
    { type: 'hold', ratio: 0.05, fromMs: 0, toMs: 300 },
    { type: 'wild', magnitude: 35, fromMs: 300, toMs: 480 },
    { type: 'hold', ratio: 0.05, fromMs: 480, toMs: 800 },
    { type: 'ramp', fromRatio: 0.05, toRatio: 0.9, fromMs: 800, toMs: 1200 },
    { type: 'hold', ratio: 0.9, fromMs: 1200, toMs: 1600 }
  ])
  check(swing.fires.length === 1, `挥拍干扰不应误触发，且后续抬腕应正常触发，实际 ${swing.fires.length} 次`)

  // 5. 初始就处于观看姿态：未经历垂手→抬腕的过程，不应触发
  const viewing = runGesture([{ type: 'hold', ratio: 0.9, fromMs: 0, toMs: 2000 }])
  check(viewing.fires.length === 0, '初始观看姿态不应触发抬腕')

  // 6. reset 后状态清空，可重新开始完整检测
  viewing.detector.reset()
  const afterReset = runGesture([
    { type: 'hold', ratio: 0.05, fromMs: 0, toMs: 300 },
    { type: 'ramp', fromRatio: 0.05, toRatio: 0.9, fromMs: 300, toMs: 700 },
    { type: 'hold', ratio: 0.9, fromMs: 700, toMs: 1100 }
  ], viewing.detector)
  check(afterReset.fires.length === 1, `reset 后应重新可检测抬腕，实际 ${afterReset.fires.length} 次`)

  console.log('wristRaise tests passed')
}

try {
  runTests()
} catch (error) {
  console.error(error)
  process.exit(1)
}
