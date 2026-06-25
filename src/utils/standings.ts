import { Tournament, Player } from '../types'

export interface PlayerStanding {
  player: Player
  gamesPlayed: number
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  differential: number
  tournamentPoints: number
  avgPoints: number
  avgDifferential: number
}

export function calculateStandings(tournament: Tournament): PlayerStanding[] {
  const { players, rounds } = tournament

  const map = new Map<number, PlayerStanding>(
    players.map(p => [p.id, {
      player: p,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      differential: 0,
      tournamentPoints: 0,
      avgPoints: 0,
      avgDifferential: 0,
    }])
  )

  for (const round of rounds) {
    for (const game of round.games) {
      if (!game.score) continue
      const { score1, score2 } = game.score
      const team1Won = score1 > score2

      for (const pid of game.team1.playerIds) {
        const s = map.get(pid)!
        s.gamesPlayed++
        s.pointsFor += score1
        s.pointsAgainst += score2
        s.differential += score1 - score2
        if (team1Won) { s.wins++; s.tournamentPoints++ } else s.losses++
      }
      for (const pid of game.team2.playerIds) {
        const s = map.get(pid)!
        s.gamesPlayed++
        s.pointsFor += score2
        s.pointsAgainst += score1
        s.differential += score2 - score1
        if (!team1Won) { s.wins++; s.tournamentPoints++ } else s.losses++
      }
    }
  }

  const standings = [...map.values()]
  for (const s of standings) {
    s.avgPoints = s.gamesPlayed > 0 ? s.tournamentPoints / s.gamesPlayed : 0
    s.avgDifferential = s.gamesPlayed > 0 ? s.differential / s.gamesPlayed : 0
  }

  return standings.filter(s => !s.player.isBot).sort((a, b) => {
    if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints
    if (b.avgDifferential !== a.avgDifferential) return b.avgDifferential - a.avgDifferential
    return b.pointsFor - a.pointsFor
  })
}
