export type Format = '4v4' | '6v6'
export type SitOutMode = 'strict' | 'flexible'
export type Locale = 'sv' | 'en'
export type Screen = 'setup' | 'players' | 'tournament'

export interface TournamentSettings {
  format: Format
  playersPerTeam: number
  numCourts: number
  numRounds: number
  numPlayers: number
  sitOutMode: SitOutMode
  tournamentName: string
  tournamentDate: string  // ISO date: YYYY-MM-DD
}

export interface Player {
  id: number
  name: string
  isBot?: boolean
}

export interface Team {
  playerIds: number[]
}

export interface GameScore {
  score1: number
  score2: number
}

export interface Game {
  court: number
  team1: Team
  team2: Team
  score?: GameScore
}

export interface Round {
  roundNumber: number
  games: Game[]
  sitOutPlayerIds: number[]
}

export interface Tournament {
  settings: TournamentSettings
  players: Player[]
  rounds: Round[]
  locale: Locale
}
