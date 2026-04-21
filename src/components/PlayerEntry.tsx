import { useState } from 'react'
import { Player, TournamentSettings, Locale } from '../types'

interface Props {
  settings: TournamentSettings
  locale: Locale
  onBack: () => void
  onStart: (players: Player[]) => void
}

export function PlayerEntry({ settings, locale, onBack, onStart }: Props) {
  const sv = locale === 'sv'
  const { numPlayers } = settings

  const [names, setNames] = useState<string[]>(Array(numPlayers).fill(''))

  function fillAll() {
    setNames(Array.from({ length: numPlayers }, (_, i) => `${sv ? 'Spelare' : 'Player'} ${i + 1}`))
  }

  function setName(i: number, value: string) {
    setNames(prev => prev.map((n, idx) => idx === i ? value : n))
  }

  const allFilled = names.every(n => n.trim().length > 0)

  function handleStart() {
    const players: Player[] = names.map((name, i) => ({ id: i, name: name.trim() }))
    onStart(players)
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="btn btn-ghost" onClick={onBack}>← {sv ? 'Tillbaka' : 'Back'}</button>
        <h2 className="screen-title">{sv ? 'Spelare' : 'Players'}</h2>
        <button className="btn btn-ghost" onClick={fillAll}>{sv ? 'Fyll alla' : 'Fill all'}</button>
      </div>

      <div className="card">
        <div className="player-grid">
          {names.map((name, i) => (
            <div key={i} className="player-entry-row">
              <span className="player-number">{i + 1}</span>
              <input
                className="form-input"
                type="text"
                placeholder={`${sv ? 'Spelare' : 'Player'} ${i + 1}`}
                value={name}
                onChange={e => setName(i, e.target.value)}
                maxLength={30}
              />
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn-primary btn-full" disabled={!allFilled} onClick={handleStart}>
        {sv ? 'Starta turnering →' : 'Start tournament →'}
      </button>
    </div>
  )
}
