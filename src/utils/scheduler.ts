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

function scoreTeams(teams: number[][], teammates: number[][]): number {
  let score = 0
  for (const team of teams) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        score += teammates[team[i]][team[j]]
      }
    }
  }
  return score
}

function formTeams(playerIds: number[], teamSizes: number[], teammates: number[][]): number[][] {
  const RESTARTS = 800
  let best: number[][] = []
  let bestScore = Infinity
  for (let r = 0; r < RESTARTS; r++) {
    const s = shuffle(playerIds)
    const assignment: number[][] = []
    let offset = 0
    for (const size of teamSizes) {
      assignment.push(s.slice(offset, offset + size))
      offset += size
    }
    const score = scoreTeams(assignment, teammates)
    if (score < bestScore) { bestScore = score; best = assignment }
  }
  return best
}

// Enumerate all perfect matchings of an even-length index array
function perfectMatchings(indices: number[]): [number, number][][] {
  if (indices.length === 0) return [[]]
  const result: [number, number][][] = []
  const first = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const partner = indices[i]
    const rest = indices.filter((_, idx) => idx !== 0 && idx !== i)
    for (const sub of perfectMatchings(rest)) {
      result.push([[first, partner], ...sub])
    }
  }
  return result
}

function pairTeams(teams: number[][], opponents: number[][]): [number[], number[]][] {
  const matchings = perfectMatchings(teams.map((_, i) => i))
  let bestPairs: [number, number][] = matchings[0]
  let bestScore = Infinity
  for (const matching of matchings) {
    let score = 0
    for (const [t1, t2] of matching) {
      for (const p1 of teams[t1]) {
        for (const p2 of teams[t2]) {
          score += opponents[p1][p2]
        }
      }
    }
    if (score < bestScore) { bestScore = score; bestPairs = matching }
  }
  return bestPairs.map(([t1, t2]) => [teams[t1], teams[t2]])
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
  // strict: use as many full games as possible up to numCourts
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
      // Sort: fewest sit-outs first, break ties by random
      const sorted = shuffle([...players]).sort(
        (a, b) => (sitOutCounts.get(a.id) ?? 0) - (sitOutCounts.get(b.id) ?? 0)
      )
      sitOutPlayers = sorted.slice(0, numSitOut)
      activePlayers = sorted.slice(numSitOut)
    }
  } else {
    // flexible: all play, distribute across numCourts * 2 teams
    activePlayers = [...players]
    sitOutPlayers = []
  }

  const activeIds = activePlayers.map(p => p.id)
  const numTeams = (sitOutMode === 'strict'
    ? Math.min(numCourts, Math.floor(n / (2 * playersPerTeam))) * 2
    : numCourts * 2)

  // Build team sizes
  let teamSizes: number[]
  if (sitOutMode === 'strict') {
    teamSizes = Array(numTeams).fill(playersPerTeam) as number[]
  } else {
    const base = Math.floor(activeIds.length / numTeams)
    const extra = activeIds.length % numTeams
    teamSizes = Array.from({ length: numTeams }, (_, i) => i < extra ? base + 1 : base)
  }

  const teams = formTeams(activeIds, teamSizes, teammates)
  const gamePairs = pairTeams(teams, opponents)

  const games: Game[] = gamePairs.map(([t1, t2], i) => ({
    court: i + 1,
    team1: { playerIds: t1 },
    team2: { playerIds: t2 },
  }))

  return {
    roundNumber: completedRounds.length + 1,
    games,
    sitOutPlayerIds: sitOutPlayers.map(p => p.id),
  }
}
