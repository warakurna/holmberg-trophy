import { Tournament } from '../types'

export interface PairStats {
  together: number
  against: number
}

export function analyzeSchedule(tournament: Tournament): Map<string, PairStats> {
  const map = new Map<string, PairStats>()

  function key(a: number, b: number) {
    return a < b ? `${a}_${b}` : `${b}_${a}`
  }

  function get(a: number, b: number): PairStats {
    const k = key(a, b)
    if (!map.has(k)) map.set(k, { together: 0, against: 0 })
    return map.get(k)!
  }

  for (const round of tournament.rounds) {
    for (const game of round.games) {
      const t1 = game.team1.playerIds
      const t2 = game.team2.playerIds

      for (let i = 0; i < t1.length; i++)
        for (let j = i + 1; j < t1.length; j++)
          get(t1[i], t1[j]).together++

      for (let i = 0; i < t2.length; i++)
        for (let j = i + 1; j < t2.length; j++)
          get(t2[i], t2[j]).together++

      for (const p1 of t1)
        for (const p2 of t2)
          get(p1, p2).against++
    }
  }

  return map
}
