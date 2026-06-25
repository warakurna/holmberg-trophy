import { Player, Round, Game, TournamentSettings } from '../types'

// Per real player on a short team: penalty scaled by how many short-team rounds they've had
const SHORT_FAIRNESS_WEIGHT = 60
// Per game where exactly one team has a bot (prefer S vs S, F vs F over S vs F)
const MIXED_GAME_PENALTY = 500

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

// Counts how many rounds each real player has spent on a team with any bot (unified, not per-bot)
function computeShortCount(realPlayerIds: number[], rounds: Round[], botIdSet: Set<number>): Map<number, number> {
  const counts = new Map<number, number>(realPlayerIds.map(id => [id, 0]))
  for (const round of rounds) {
    for (const game of round.games) {
      for (const team of [game.team1, game.team2]) {
        if (team.playerIds.some(id => botIdSet.has(id))) {
          for (const pid of team.playerIds) {
            if (!botIdSet.has(pid) && counts.has(pid))
              counts.set(pid, counts.get(pid)! + 1)
          }
        }
      }
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
function crossPenalty(tm: number, opp: number): number {
  if (tm === 0 || opp === 0) return 0
  const total = tm + opp
  if (total === 2) return 10
  if (total === 3) return 300
  return 2000
}

function scoreOneGame(
  game: [number[], number[]],
  teammates: number[][],
  opponents: number[][],
  botIdSet?: Set<number>,
  shortCount?: Map<number, number>
): number {
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

  if (botIdSet && shortCount) {
    const t1HasBot = t1.some(id => botIdSet.has(id))
    const t2HasBot = t2.some(id => botIdSet.has(id))

    // Short-team fairness: penalise high-shortCount real players being on a bot team
    if (t1HasBot)
      for (const pid of t1)
        if (!botIdSet.has(pid)) score += (shortCount.get(pid) ?? 0) * SHORT_FAIRNESS_WEIGHT
    if (t2HasBot)
      for (const pid of t2)
        if (!botIdSet.has(pid)) score += (shortCount.get(pid) ?? 0) * SHORT_FAIRNESS_WEIGHT

    // Mixed-game penalty: strongly prefer S vs S and F vs F over S vs F
    if (t1HasBot !== t2HasBot) score += MIXED_GAME_PENALTY
  }

  return score
}

function scoreGames(
  games: [number[], number[]][],
  teammates: number[][],
  opponents: number[][],
  botIdSet?: Set<number>,
  shortCount?: Map<number, number>
): number {
  return games.reduce((sum, game) => sum + scoreOneGame(game, teammates, opponents, botIdSet, shortCount), 0)
}

// Greedy initialization: assign players to minimize immediate cost for each slot
function greedyInitGames(
  playerIds: number[],
  gameSizes: [number, number][],
  teammates: number[][],
  opponents: number[][],
  botIdSet?: Set<number>,
  shortCount?: Map<number, number>
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
          // Short-team fairness: penalise high-shortCount real players in bot teams
          if (botIdSet && shortCount && !botIdSet.has(pid)) {
            if (games[g][side].some(id => botIdSet.has(id)))
              cost += (shortCount.get(pid) ?? 0) * SHORT_FAIRNESS_WEIGHT
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

// Simulated annealing over the full round (teams + game pairings jointly)
function simulatedAnnealing(
  initial: [number[], number[]][],
  teammates: number[][],
  opponents: number[][],
  maxIter: number,
  botIdSet?: Set<number>,
  shortCount?: Map<number, number>
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

  // Cache per-game scores to compute deltas without rescoring all games
  const gameScores = games.map(game => scoreOneGame(game, teammates, opponents, botIdSet, shortCount))
  let currentScore = gameScores.reduce((a, b) => a + b, 0)
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

    // Perform the swap, evaluate, then undo if rejected
    ;[games[g1][s1][p1], games[g2][s2][p2]] = [games[g2][s2][p2], games[g1][s1][p1]]

    let delta: number
    if (g1 === g2) {
      // Same game, different sides: rescore the one affected game
      const newScore = scoreOneGame(games[g1], teammates, opponents, botIdSet, shortCount)
      delta = newScore - gameScores[g1]
      if (delta <= 0 || Math.random() < Math.exp(-delta / temp)) {
        gameScores[g1] = newScore
        currentScore += delta
      } else {
        ;[games[g1][s1][p1], games[g2][s2][p2]] = [games[g2][s2][p2], games[g1][s1][p1]]
      }
    } else {
      // Different games: rescore both affected games
      const newG1 = scoreOneGame(games[g1], teammates, opponents, botIdSet, shortCount)
      const newG2 = scoreOneGame(games[g2], teammates, opponents, botIdSet, shortCount)
      delta = (newG1 + newG2) - (gameScores[g1] + gameScores[g2])
      if (delta <= 0 || Math.random() < Math.exp(-delta / temp)) {
        gameScores[g1] = newG1
        gameScores[g2] = newG2
        currentScore += delta
      } else {
        ;[games[g1][s1][p1], games[g2][s2][p2]] = [games[g2][s2][p2], games[g1][s1][p1]]
      }
    }

    if (currentScore < bestScore) {
      bestScore = currentScore
      for (let g = 0; g < best.length; g++) { best[g][0] = [...games[g][0]]; best[g][1] = [...games[g][1]] }
      if (bestScore === 0) return best
    }
    temp *= cooling
  }
  return best
}

function scheduleGames(
  playerIds: number[],
  gameSizes: [number, number][],
  teammates: number[][],
  opponents: number[][],
  botIdSet?: Set<number>,
  shortCount?: Map<number, number>
): [number[], number[]][] {
  const RESTARTS = 80
  const SA_ITERS = 20000
  let best: [number[], number[]][] = []
  let bestScore = Infinity

  for (let r = 0; r < RESTARTS; r++) {
    const initial = greedyInitGames(playerIds, gameSizes, teammates, opponents, botIdSet, shortCount)
    const improved = simulatedAnnealing(initial, teammates, opponents, SA_ITERS, botIdSet, shortCount)
    const score = scoreGames(improved, teammates, opponents, botIdSet, shortCount)
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

  // Forbid bot-bot teammate pairings by pre-seeding their count to 2 (triggers 3000 "forbidden" penalty)
  const botIdSet = new Set(players.filter(p => p.isBot).map(p => p.id))
  const botIds = [...botIdSet]
  for (let i = 0; i < botIds.length; i++)
    for (let j = i + 1; j < botIds.length; j++) {
      teammates[botIds[i]][botIds[j]] = 2
      teammates[botIds[j]][botIds[i]] = 2
    }

  // Unified short-team count: total rounds each real player has spent on a bot team
  const realPlayerIds = players.filter(p => !p.isBot).map(p => p.id)
  const shortCount = botIdSet.size > 0
    ? computeShortCount(realPlayerIds, completedRounds, botIdSet)
    : undefined

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

  const games = scheduleGames(activeIds, gameSizes, teammates, opponents, botIdSet.size > 0 ? botIdSet : undefined, shortCount)

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
