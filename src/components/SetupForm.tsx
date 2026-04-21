import { useState } from 'react'
import { TournamentSettings, Locale, Format, SitOutMode } from '../types'
import { getScheduleInfo } from '../utils/scheduler'
import { FlagIcon } from './FlagIcon'

interface Props {
  locale: Locale
  onToggleLocale: () => void
  onNext: (settings: TournamentSettings) => void
}

export function SetupForm({ locale, onToggleLocale, onNext }: Props) {
  const sv = locale === 'sv'
  const [format, setFormat] = useState<Format>('4v4')
  const [numCourts, setNumCourts] = useState(3)
  const [numRounds, setNumRounds] = useState(6)
  const [numPlayers, setNumPlayers] = useState(28)
  const [sitOutMode, setSitOutMode] = useState<SitOutMode>('strict')

  const playersPerTeam = format === '4v4' ? 4 : 6

  const settings: TournamentSettings = { format, playersPerTeam, numCourts, numRounds, numPlayers, sitOutMode }
  const info = getScheduleInfo(settings)

  const minPlayers = 2 * playersPerTeam
  const valid = numPlayers >= minPlayers && numCourts >= 1 && numRounds >= 1

  function schedulePreview() {
    if (sitOutMode === 'strict') {
      if (info.numSitOuts === 0) return sv ? `${info.numGames} spel, alla spelar` : `${info.numGames} games, all play`
      return sv
        ? `${info.numGames} spel, ${info.numSitOuts} spelare sitter av per omgång`
        : `${info.numGames} games, ${info.numSitOuts} players sit out per round`
    }
    const base = Math.floor(numPlayers / (numCourts * 2))
    const extra = numPlayers % (numCourts * 2)
    if (extra === 0) return sv ? `${numCourts} spel, lag om ${base}` : `${numCourts} games, teams of ${base}`
    return sv
      ? `${numCourts} spel, ${extra} lag om ${base + 1} + ${numCourts * 2 - extra} lag om ${base}`
      : `${numCourts} games, ${extra} teams of ${base + 1} + ${numCourts * 2 - extra} teams of ${base}`
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="app-title">Holmberg Trophy</h1>
        <button className="flag-btn" onClick={onToggleLocale} aria-label="Switch language">
          <FlagIcon locale={locale === 'sv' ? 'en' : 'sv'} size={28} />
        </button>
      </div>

      <div className="card">
        <h2 className="section-title">{sv ? 'Turneringsinställningar' : 'Tournament Setup'}</h2>

        <div className="form-group">
          <label className="form-label">{sv ? 'Format' : 'Format'}</label>
          <div className="radio-group">
            {(['4v4', '6v6'] as Format[]).map(f => (
              <label key={f} className={`radio-option ${format === f ? 'selected' : ''}`}>
                <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} />
                {f === '4v4' ? (sv ? 'Fyrmanna (4v4)' : '4-a-side (4v4)') : (sv ? 'Inomhus 6v6' : 'Indoor 6v6')}
              </label>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{sv ? 'Antal planer' : 'Courts'}</label>
            <input className="form-input narrow" type="number" min={1} max={8} value={numCourts}
              onChange={e => setNumCourts(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div className="form-group">
            <label className="form-label">{sv ? 'Antal omgångar' : 'Rounds'}</label>
            <input className="form-input narrow" type="number" min={1} max={20} value={numRounds}
              onChange={e => setNumRounds(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div className="form-group">
            <label className="form-label">{sv ? 'Antal spelare' : 'Players'}</label>
            <input className="form-input narrow" type="number" min={minPlayers} max={64} value={numPlayers}
              onChange={e => setNumPlayers(Math.max(minPlayers, parseInt(e.target.value) || minPlayers))} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{sv ? 'Avbytarregler' : 'Sit-out rules'}</label>
          <div className="radio-group">
            <label className={`radio-option ${sitOutMode === 'strict' ? 'selected' : ''}`}>
              <input type="radio" name="sitout" value="strict" checked={sitOutMode === 'strict'} onChange={() => setSitOutMode('strict')} />
              {sv ? 'Strikt — hela lag, spelare sitter av' : 'Strict — full teams, players sit out'}
            </label>
            <label className={`radio-option ${sitOutMode === 'flexible' ? 'selected' : ''}`}>
              <input type="radio" name="sitout" value="flexible" checked={sitOutMode === 'flexible'} onChange={() => setSitOutMode('flexible')} />
              {sv ? 'Flexibel — ojämna lag, alla spelar' : 'Flexible — uneven teams, all play'}
            </label>
          </div>
        </div>

        <div className="schedule-preview">
          {schedulePreview()}
        </div>

        {!valid && (
          <p className="form-error">
            {sv ? `Minst ${minPlayers} spelare krävs` : `Minimum ${minPlayers} players required`}
          </p>
        )}

        <button className="btn btn-primary btn-full" disabled={!valid} onClick={() => onNext(settings)}>
          {sv ? 'Ange spelare →' : 'Enter players →'}
        </button>
      </div>
    </div>
  )
}
