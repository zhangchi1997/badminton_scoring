const G = 9.81

/**
 * 抬腕亮屏检测：
 * 手臂自然下垂时表盘近乎竖直，重力几乎不落在表盘法线（z 轴）上，
 * |gz|/|g| 接近 0；抬腕看分时表盘转向面部，法线趋于竖直，该比值显著上升。
 * 检测「比值从低位快速升到高位」这一翻转动作即视为抬腕，取绝对值可兼容左右手与倒装佩戴。
 *
 * 幅值门限以持续更新的基线幅值（缓慢 EMA）为参照，
 * 不依赖固件的单位约定（m/s² 或 g 均可），并可滤掉剧烈挥拍等线性加速度为主的样本。
 */
export function createWristRaiseDetector(options = {}) {
  const {
    onRaise = () => {},
    downRatio = 0.4,      // 比值低于此值视为垂手（表盘竖直）
    upRatio = 0.75,       // 比值高于此值视为观看姿态（表盘朝脸）
    maxRiseMs = 700,      // 从垂手到观看姿态允许的最长过渡时间
    cooldownMs = 2000,    // 触发后的冷却时间，避免反复点亮
    alpha = 0.6,          // 重力低通系数，按 ~60ms 采样间隔整定
    baselineAlpha = 0.95, // 基线幅值 EMA 系数，用于幅值门限
    now = () => Date.now()
  } = options

  let gx = 0
  let gy = 0
  let gz = 0
  let hasGravity = false
  let baseline = 0
  let lastDownTime = -Infinity
  let lastFireTime = -Infinity

  function reset() {
    gx = 0
    gy = 0
    gz = 0
    hasGravity = false
    baseline = 0
    lastDownTime = -Infinity
    lastFireTime = -Infinity
  }

  /**
   * 喂入一帧加速度数据，触发抬腕时调用 onRaise 并返回 true。
   * timestamp 可省略（默认取当前时间），便于用合成序列做单元测试。
   */
  function feed(ax, ay, az, timestamp = now()) {
    const magnitude = Math.sqrt(ax * ax + ay * ay + az * az)
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      return false
    }
    // 与基线幅值偏差过大的样本以线性加速度为主（如挥拍），不可信，直接丢弃
    if (baseline > 0 && (magnitude < baseline * 0.5 || magnitude > baseline * 2)) {
      return false
    }

    if (!hasGravity) {
      gx = ax
      gy = ay
      gz = az
      hasGravity = true
    } else {
      gx = gx * alpha + ax * (1 - alpha)
      gy = gy * alpha + ay * (1 - alpha)
      gz = gz * alpha + az * (1 - alpha)
    }
    baseline = baseline === 0 ? magnitude : baseline * baselineAlpha + magnitude * (1 - baselineAlpha)

    const gravityMagnitude = Math.sqrt(gx * gx + gy * gy + gz * gz)
    if (gravityMagnitude <= 0) {
      return false
    }
    const ratio = Math.abs(gz) / gravityMagnitude

    if (ratio <= downRatio) {
      lastDownTime = timestamp
      return false
    }
    if (
      ratio >= upRatio &&
      timestamp - lastDownTime <= maxRiseMs &&
      timestamp - lastFireTime >= cooldownMs
    ) {
      lastFireTime = timestamp
      onRaise()
      return true
    }
    return false
  }

  return { feed, reset }
}
