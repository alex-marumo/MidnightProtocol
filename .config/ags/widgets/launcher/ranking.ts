const scores: Record<string, number> = {}

export function bumpRanking(key: string, delta = 1) {
  scores[key] = (scores[key] || 0) + delta
}

export function getRanking(key: string) {
  return scores[key] || 0
}

export function resetRanking() {
  for (const k in scores) delete scores[k]
}
