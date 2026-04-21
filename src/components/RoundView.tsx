import { useState } from 'react'
import { Round, Player, Locale, GameScore } from '../types'

interface Props {
  round: Round
  players: Player[]
  locale: Locale
  isComplete: boolean
  displayMode: boolean
  onScoreSubmit: (gameIndex: number, score: GameScore) => void
}

function playerName(id: number, players: Player[]) {
  return players.find(p => p.id === id)?.name ?? `#${id}`
}

interface ScoreInputProps {
  gameIndex: number
  team1Label: string
  team2Label: string
  existing?: GameScore
  locale: Locale
  onSubmit: (score: GameScore) => void
}

function ScoreInput({ gameIndex: _gameIndex, team1Label, team2Label, existing, locale, onSubmit }: ScoreInputProps) {
  const sv = locale === 'sv'
  const [s1, setS1] = useState(existing ? String(existing.score1) : '')
  const [s2, setS2] = useState(existing ? String(existing.score2) : '')
  const [error, setError] = useState('')

  if (existing) {
    return (
      <div className="score-display">
        <span className="score-value">{existing.score1} – {existing.score2}</span>
        <span className="score-winner">
          {existing.score1 > existing.score2 ? `${team1Label} ${sv ? 'vinner' : 'wins'}` : `${team2Label} ${sv ? 'vinner' : 'wins'}`}
        </span>
      </div>
    )
  }

  function handleSubmit() {
    const n1 = parseInt(s1), n2 = parseInt(s2)
    if (isNaN(n1) || isNaN(n2) || n1 < 0 || n2 < 0) {
      setError(sv ? 'Ange giltiga poäng' : 'Enter valid scores')
      return
    }
    if (n1 === n2) {
      setError(sv ? 'Oavgjort är inte tillåtet' : 'Ties are not allowed')
      return
    }
    setError('')
    onSubmit({ score1: n1, score2: n2 })
  }

  return (
    <div className="score-input-row">
      <input className="score-input" type="number" min={0} value={s1}
        onChange={e => setS1(e.target.value)} placeholder="0" />
      <span className="score-dash">–</span>
      <input className="score-input" type="number" min={0} value={s2}
        onChange={e => setS2(e.target.value)} placeholder="0" />
      <button className="btn btn-sm btn-primary" onClick={handleSubmit}>OK</button>
      {error && <span className="score-error">{error}</span>}
    </div>
  )
}

export function RoundView({ round, players, locale, isComplete, displayMode, onScoreSubmit }: Props) {
  const sv = locale === 'sv'

  return (
    <div className="round-view">
      {round.games.map((game, i) => {
        const t1Names = game.team1.playerIds.map(id => playerName(id, players))
        const t2Names = game.team2.playerIds.map(id => playerName(id, players))
        const t1Size = game.team1.playerIds.length
        const t2Size = game.team2.playerIds.length
        const unevenLabel = t1Size !== t2Size ? ` (${t1Size}v${t2Size})` : ''

        return (
          <div key={i} className={`game-card ${game.score ? 'has-score' : ''}`}>
            <div className="game-court">
              {sv ? `Plan ${game.court}` : `Court ${game.court}`}{unevenLabel}
            </div>
            <div className="game-teams">
              <div className={`team-column ${game.score && game.score.score1 > game.score.score2 ? 'winner' : ''}`}>
                <div className="team-label">{sv ? 'Lag 1' : 'Team 1'}</div>
                {t1Names.map((name, j) => <div key={j} className="player-name">{name}</div>)}
              </div>
              <div className="vs-divider">vs</div>
              <div className={`team-column ${game.score && game.score.score2 > game.score.score1 ? 'winner' : ''}`}>
                <div className="team-label">{sv ? 'Lag 2' : 'Team 2'}</div>
                {t2Names.map((name, j) => <div key={j} className="player-name">{name}</div>)}
              </div>
            </div>

            {!displayMode && (
              <ScoreInput
                gameIndex={i}
                team1Label={sv ? 'Lag 1' : 'Team 1'}
                team2Label={sv ? 'Lag 2' : 'Team 2'}
                existing={game.score}
                locale={locale}
                onSubmit={score => onScoreSubmit(i, score)}
              />
            )}
            {displayMode && game.score && (
              <div className="score-display">
                <span className="score-value">{game.score.score1} – {game.score.score2}</span>
              </div>
            )}
            {displayMode && !game.score && (
              <div className="score-pending">{sv ? 'Pågår...' : 'In progress...'}</div>
            )}
          </div>
        )
      })}

      {round.sitOutPlayerIds.length > 0 && (
        <div className="sitout-bar">
          <span className="sitout-label">{sv ? 'Sitter av:' : 'Sitting out:'}</span>
          {round.sitOutPlayerIds.map(id => playerName(id, players)).join(', ')}
        </div>
      )}

      {isComplete && !displayMode && (
        <div className="round-complete-badge">
          {sv ? '✓ Alla resultat inlagda' : '✓ All scores entered'}
        </div>
      )}
    </div>
  )
}
