import { Player, Round, Game, TournamentSettings } from '../types'

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildHistory(numPlayers: number, rounds: Round[]) {
  const teammates = Array.from({ length: numPlayers }, () => new Array(numPlayers).fill(0) as number[])
  const opponents = Array.from({ length: numPlayers }, () => new Array(numPlayers).fill(0) as number[])
  for (const round of rounds) {
    for (const game of round.games) {
      for (let i = 0; i < game.team1.playerIds.length; i++) {
        for (let j = i + 1; j < game.team1.playerIds.length; j++) {
          const a = game.team1.playerIds[i], b = game.team1.playerIds[j]
          teammates[a][b]++; teammates[b][a]++
        }
      }
      for (let i = 0; i < game.team2.playerIds.length; i++) {
        for (let j = i + 1; j < game.team2.playerIds.length; j++) {
          const a = game.team2.playerIds[i], b = game.team2.playerIds[j]
          teammates[a][b]++; teammates[b][a]++
        }
      }
      for (const a of game.team1.playerIds) {
        for (const b of game.team2.playerIds) {
          opponents[a][b]++; opponents[b][a]++
        }
      }
    }
  }
  return { teammates, opponents }
}

function getSitOutCounts(players: Player[], rounds: Round[]): Map<number, number> {
  const counts = new Map<number, number>(players.map(p => [p.id, 0]))
  for (const round of rounds) {
    for (const pid of round.sitOutPlayerIds) {
      counts.set(pid, (counts.get(pid) ?? 0) + 1)
    }
  }
  return counts
}

// Teammate repeat: avoidable → penalise hard but not so extreme that SA sacrifices opponents
function tmPenalty(count: number): number {
  if (count === 0) return 0
  if (count === 1) return 100   // 2nd time as teammate: expensive
  return 3000                    // 3rd+: essentially forbidden
}

// Opponent repeat: 12 pairs must meet twice → penalise moderately
function oppPenalty(count: number): number {
  if (count === 0) return 0
  if (count === 1) return 30    // 2nd time as opponent: noticeable but not catastrophic
  return 1000                    // 3rd+: essentially forbidden
}

// Cross-role penalty — reflects user preference: 1/2 << 2/0 << 2/1
// 1/1 total=2: tiny extra so 2/1 costs more than 2/0, but 1/2 still much cheaper than 2/0
// 2/1 or 1/2 total=3: large extra, essentially forbidden
function crossPenalty(tm: number, opp: number): number {
  if (tm === 0 || opp === 0) return 0
  const total = tm + opp
  if (total === 2) return 10             // 1/1 → 2/1=110, 1/2=40 (1/2 is much cheaper than 2/0=100)
  if (total === 3) return 300            // 2/1 or 1/2 → further meetings near-forbidden
  return 2000                            // 2/2+: forbidden
}

function scoreGames(
  games: [number[], number[]][],
  teammates: number[][],
  opponents: number[][]
): number {
  let score = 0
  for (const [t1, t2] of games) {
    for (let i = 0; i < t1.length; i++)
      for (let j = i + 1; j < t1.length; j++) {
        const tm = teammates[t1[i]][t1[j]], opp = opponents[t1[i]][t1[j]]
        score += tmPenalty(tm) + crossPenalty(tm, opp)
      }
    for (let i = 0; i < t2.length; i++)
      for (let j = i + 1; j < t2.length; j++) {
        const tm = teammates[t2[i]][t2[j]], opp = opponents[t2[i]][t2[j]]
        score += tmPenalty(tm) + crossPenalty(tm, opp)
      }
    for (const p1 of t1)
      for (const p2 of t2) {
        const tm = teammates[p1][p2], opp = opponents[p1][p2]
        score += oppPenalty(opp) + crossPenalty(tm, opp)
      }
  }
  return score
}

// Greedy initialization: assign players to minimize immediate cost for each slot
function greedyInitGames(
  playerIds: number[],
  gameSizes: [number, number][],
  teammates: number[][],
  opponents: number[][]
): [number[], number[]][] {
  const games: [number[], number[]][] = gameSizes.map(() => [[], []])
  const avail = new Set(shuffle([...playerIds]))

  for (const g of shuffle([...Array(games.length).keys()])) {
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < gameSizes[g][side]; i++) {
        let best = -1, bestCost = Infinity
        for (const pid of avail) {
          let cost = 0
          for (const ex of games[g][side]) {
            const tm = teammates[pid][ex], opp = opponents[pid][ex]
            cost += tmPenalty(tm) + crossPenalty(tm, opp)
          }
          if (side === 1) {
            for (const ex of games[g][0]) {
              const tm = teammates[pid][ex], opp = opponents[pid][ex]
              cost += oppPenalty(opp) + crossPenalty(tm, opp)
            }
          }
          if (cost < bestCost) { bestCost = cost; best = pid }
        }
        if (best === -1) best = avail.values().next().value as number
        games[g][side].push(best)
        avail.delete(best)
      }
    }
  }
  return games
}

function scoreOneGame(game: [number[], number[]], teammates: number[][], opponents: number[][]): number {
  let score = 0
  const [t1, t2] = game
  for (let i = 0; i < t1.length; i++)
    for (let j = i + 1; j < t1.length; j++) {
      const tm = teammates[t1[i]][t1[j]], opp = opponents[t1[i]][t1[j]]
      score += tmPenalty(tm) + crossPenalty(tm, opp)
    }
  for (let i = 0; i < t2.length; i++)
    for (let j = i + 1; j < t2.length; j++) {
      const tm = teammates[t2[i]][t2[j]], opp = opponents[t2[i]][t2[j]]
      score += tmPenalty(tm) + crossPenalty(tm, opp)
    }
  for (const p1 of t1)
    for (const p2 of t2) {
      const tm = teammates[p1][p2], opp = opponents[p1][p2]
      score += oppPenalty(opp) + crossPenalty(tm, opp)
    }
  return score
}

// Simulated annealing over the full round (teams + game pairings jointly)
function simulatedAnnealing(
  initial: [number[], number[]][],
  teammates: number[][],
  opponents: number[][],
  maxIter: number
): [number[], number[]][] {
  // Build flat slot list for O(1) random access: [gameIdx, side, posInTeam]
  type Slot = [number, 0 | 1, number]
  const slots: Slot[] = []
  for (let g = 0; g < initial.length; g++) {
    for (let p = 0; p < initial[g][0].length; p++) slots.push([g, 0, p])
    for (let p = 0; p < initial[g][1].length; p++) slots.push([g, 1, p])
  }
  const n = slots.length

  const games = initial.map(([t1, t2]) => [[...t1], [...t2]] as [number[], number[]])
  let currentScore = scoreGames(games, teammates, opponents)
  let best = games.map(([t1, t2]) => [[...t1], [...t2]] as [number[], number[]])
  let bestScore = currentScore
  if (bestScore === 0) return best

  // Start at high temp so SA can escape local optima; cool to near-zero
  let temp = 50.0
  const cooling = Math.pow(0.1 / temp, 1 / maxIter)

  for (let iter = 0; iter < maxIter; iter++) {
    const i1 = Math.floor(Math.random() * n)
    let i2 = Math.floor(Math.random() * (n - 1))
    if (i2 >= i1) i2++
    const [g1, s1, p1] = slots[i1]
    const [g2, s2, p2] = slots[i2]

    // Same team: swapping positions doesn't change score
    if (g1 === g2 && s1 === s2) { temp *= cooling; continue }

    let delta: number
    if (g1 === g2) {
      // Same game, different side: rescore the one affected game
      const before = scoreOneGame(games[g1], teammates, opponents)
      ;[games[g1][s1][p1], games[g2][s2][p2]] = [games[g2][s2][p2], games[g1][s1][p1]]
      delta = scoreOneGame(games[g1], teammates, opponents) - before
      ;[games[g1][s1][p1], games[g2][s2][p2]] = [games[g2][s2][p2], games[g1][s1][p1]]
    } else {
      // Different games: compute delta from only the affected player pairs (O(k) vs O(k²×games))
      const A = games[g1][s1][p1]
      const B = games[g2][s2][p2]
      const oS1 = (1 - s1) as 0 | 1
      const oS2 = (1 - s2) as 0 | 1
      let oldA = 0, newB = 0
      for (const pid of games[g1][s1]) {
        if (pid === A) continue
        oldA += tmPenalty(teammates[A][pid]) + crossPenalty(teammates[A][pid], opponents[A][pid])
        newB += tmPenalty(teammates[B][pid]) + crossPenalty(teammates[B][pid], opponents[B][pid])
      }
      for (const pid of games[g1][oS1]) {
        oldA += oppPenalty(opponents[A][pid]) + crossPenalty(teammates[A][pid], opponents[A][pid])
        newB += oppPenalty(opponents[B][pid]) + crossPenalty(teammates[B][pid], opponents[B][pid])
      }
      let oldB = 0, newA = 0
      for (const pid of games[g2][s2]) {
        if (pid === B) continue
        oldB += tmPenalty(teammates[B][pid]) + crossPenalty(teammates[B][pid], opponents[B][pid])
        newA += tmPenalty(teammates[A][pid]) + crossPenalty(teammates[A][pid], opponents[A][pid])
      }
      for (const pid of games[g2][oS2]) {
        oldB += oppPenalty(opponents[B][pid]) + crossPenalty(teammates[B][pid], opponents[B][pid])
        newA += oppPenalty(opponents[A][pid]) + crossPenalty(teammates[A][pid], opponents[A][pid])
      }
      delta = (newB + newA) - (oldA + oldB)
    }

    if (delta <= 0 || Math.random() < Math.exp(-delta / temp)) {
      ;[games[g1][s1][p1], games[g2][s2][p2]] = [games[g2][s2][p2], games[g1][s1][p1]]
      currentScore += delta
      if (currentScore < bestScore) {
        bestScore = currentScore
        for (let g = 0; g < best.length; g++) { best[g][0] = [...games[g][0]]; best[g][1] = [...games[g][1]] }
        if (bestScore === 0) return best
      }
    }
    temp *= cooling
  }
  return best
}

function scheduleGames(
  playerIds: number[],
  gameSizes: [number, number][],
  teammates: number[][],
  opponents: number[][]
): [number[], number[]][] {
  const RESTARTS = 80
  const SA_ITERS = 20000
  let best: [number[], number[]][] = []
  let bestScore = Infinity

  for (let r = 0; r < RESTARTS; r++) {
    const initial = greedyInitGames(playerIds, gameSizes, teammates, opponents)
    const improved = simulatedAnnealing(initial, teammates, opponents, SA_ITERS)
    const score = scoreGames(improved, teammates, opponents)
    if (score < bestScore) {
      bestScore = score
      best = improved.map(([t1, t2]) => [[...t1], [...t2]] as [number[], number[]])
    }
    if (bestScore === 0) break
  }
  return best
}

export interface ScheduleInfo {
  numGames: number
  numSitOuts: number
}

export function getScheduleInfo(settings: TournamentSettings): ScheduleInfo {
  const { numCourts, playersPerTeam, numPlayers, sitOutMode } = settings
  if (sitOutMode === 'flexible') {
    return { numGames: numCourts, numSitOuts: 0 }
  }
  const numGames = Math.min(numCourts, Math.floor(numPlayers / (2 * playersPerTeam)))
  const numSitOuts = numPlayers - numGames * 2 * playersPerTeam
  return { numGames, numSitOuts }
}

export function scheduleRound(
  players: Player[],
  settings: TournamentSettings,
  completedRounds: Round[]
): Round {
  const { numCourts, playersPerTeam, sitOutMode } = settings
  const n = players.length
  const { teammates, opponents } = buildHistory(n, completedRounds)
  const sitOutCounts = getSitOutCounts(players, completedRounds)

  let activePlayers: Player[]
  let sitOutPlayers: Player[]

  if (sitOutMode === 'strict') {
    const numGames = Math.min(numCourts, Math.floor(n / (2 * playersPerTeam)))
    const numActive = numGames * 2 * playersPerTeam
    const numSitOut = n - numActive

    if (numSitOut <= 0) {
      activePlayers = [...players]
      sitOutPlayers = []
    } else {
      const sorted = shuffle([...players]).sort(
        (a, b) => (sitOutCounts.get(a.id) ?? 0) - (sitOutCounts.get(b.id) ?? 0)
      )
      sitOutPlayers = sorted.slice(0, numSitOut)
      activePlayers = sorted.slice(numSitOut)
    }
  } else {
    activePlayers = [...players]
    sitOutPlayers = []
  }

  const activeIds = activePlayers.map(p => p.id)

  let gameSizes: [number, number][]
  if (sitOutMode === 'strict') {
    const numGames = Math.min(numCourts, Math.floor(n / (2 * playersPerTeam)))
    gameSizes = Array.from({ length: numGames }, () => [playersPerTeam, playersPerTeam] as [number, number])
  } else {
    const numTeams = numCourts * 2
    const base = Math.floor(activeIds.length / numTeams)
    const extra = activeIds.length % numTeams
    const sizes = Array.from({ length: numTeams }, (_, i) => i < extra ? base + 1 : base)
    gameSizes = Array.from({ length: numCourts }, (_, i) => [sizes[i * 2], sizes[i * 2 + 1]] as [number, number])
  }

  const games = scheduleGames(activeIds, gameSizes, teammates, opponents)

  const roundGames: Game[] = games.map(([t1, t2], i) => ({
    court: i + 1,
    team1: { playerIds: t1 },
    team2: { playerIds: t2 },
  }))

  return {
    roundNumber: completedRounds.length + 1,
    games: roundGames,
    sitOutPlayerIds: sitOutPlayers.map(p => p.id),
  }
}
