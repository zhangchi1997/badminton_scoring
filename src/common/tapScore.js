const DEFAULT_DELAY = 200

/**
 * 区分单击与双击：delay 内第二次点击视为双击，否则延迟后执行单击。
 */
export function createTapHandler(onSingle, onDouble, delay = DEFAULT_DELAY) {
  let lastTapTime = 0
  let pendingTimer = null

  return function handleTap() {
    const now = Date.now()

    if (now - lastTapTime < delay) {
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer)
        pendingTimer = null
      }
      lastTapTime = 0
      onDouble()
      return
    }

    lastTapTime = now
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
    }

    pendingTimer = setTimeout(() => {
      pendingTimer = null
      lastTapTime = 0
      onSingle()
    }, delay)
  }
}

export function adjustScore(score, delta) {
  const next = score + delta
  return next < 0 ? 0 : next
}
