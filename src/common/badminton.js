const WIN_SCORE = 21
const WIN_DIFF = 2
const CAP_SCORE = 30

/**
 * 羽毛球一局胜负判定：
 * 先到 21 分且净胜 2 分获胜；29:29 后先到 30 分获胜（30 封顶）。
 */
export function isGameWon(score, opponentScore) {
  if (score === CAP_SCORE) {
    return true
  }
  return score >= WIN_SCORE && score - opponentScore >= WIN_DIFF
}
