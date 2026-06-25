import { useState } from 'react'
import { Tournament, TournamentSettings, Player, Locale, Screen, GameScore } from './types'
import { scheduleAllRounds } from './utils/scheduler'
import { calculateStandings } from './utils/standings'
import { saveTournament, loadTournament, clearTournament, saveLocale, loadLocale } from './utils/storage'
import { downloadSchedulePDF, downloadResultsPDF } from './utils/pdf'
import { SetupForm } from './components/SetupForm'
import { PlayerEntry } from './components/PlayerEntry'
import { RoundView } from './components/RoundView'
import { StandingsTable } from './components/StandingsTable'
import { ScheduleAnalysis } from './components/ScheduleAnalysis'
import { FlagIcon } from './components/FlagIcon'
import './App.css'

function deriveScreen(t: Tournament | null): Screen {
  if (!t) return 'setup'
  if (t.players.length === 0) return 'players'
  return 'tournament'
}

export default function App() {
  const [tournament, setTournament] = useState<Tournament | null>(loadTournament)
  const [locale, setLocale] = useState<Locale>(loadLocale)
  const [displayMode, setDisplayMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'round' | 'standings' | 'analysis'>('round')
  const [confirmReset, setConfirmReset] = useState(false)

  const screen = deriveScreen(tournament)
  const sv = locale === 'sv'

  function toggleLocale() {
    const next: Locale = locale === 'sv' ? 'en' : 'sv'
    setLocale(next)
    saveLocale(next)
    if (tournament) {
      const updated = { ...tournament, locale: next }
      setTournament(updated)
      saveTournament(updated)
    }
  }

  // ---- Setup → Players ----
  function handleSetupNext(settings: TournamentSettings) {
    const shell: Tournament = { settings, players: [], rounds: [], locale }
    setTournament(shell)
    saveTournament(shell)
  }

  // ---- Players → Tournament (generates full schedule) ----
  function handlePlayersStart(realPlayers: Player[]) {
    if (!tournament) return
    const { sitOutMode, numCourts } = tournament.settings
    let players = realPlayers
    if (sitOutMode === 'flexible') {
      const numTeams = numCourts * 2
      const remainder = realPlayers.length % numTeams
      const numBots = remainder === 0 ? 0 : numTeams - remainder
      const bots: Player[] = Array.from({ length: numBots }, (_, i) => ({
        id: realPlayers.length + i,
        name: `Bot ${i + 1}`,
        isBot: true,
      }))
      players = [...realPlayers, ...bots]
    }

    // Save shell with players but empty rounds to trigger loading screen render
    const shell: Tournament = { ...tournament, players, rounds: [] }
    setTournament(shell)
    saveTournament(shell)

    // Defer heavy SA computation so the loading screen has a chance to paint
    setTimeout(() => {
      const rounds = scheduleAllRounds(players, shell.settings)
      const updated: Tournament = { ...shell, rounds }
      setTournament(updated)
      saveTournament(updated)
    }, 50)
  }

  // ---- Score entry ----
  function handleScoreSubmit(roundIndex: number, gameIndex: number, score: GameScore) {
    if (!tournament) return
    const rounds = tournament.rounds.map((r, ri) =>
      ri !== roundIndex ? r : {
        ...r,
        games: r.games.map((g, gi) => gi !== gameIndex ? g : { ...g, score }),
      }
    )
    const updated = { ...tournament, rounds }
    setTournament(updated)
    saveTournament(updated)
  }

  // ---- Score undo ----
  function handleScoreClear(roundIndex: number, gameIndex: number) {
    if (!tournament) return
    const rounds = tournament.rounds.map((r, ri) =>
      ri !== roundIndex ? r : {
        ...r,
        games: r.games.map((g, gi) => {
          if (gi !== gameIndex) return g
          const { score: _score, ...rest } = g
          return rest
        }),
      }
    )
    const updated = { ...tournament, rounds }
    setTournament(updated)
    saveTournament(updated)
  }

  // ---- Reset ----
  function handleReset() {
    clearTournament()
    setTournament(null)
    setConfirmReset(false)
    setDisplayMode(false)
    setActiveTab('round')
  }

  // ---- Render setup ----
  if (screen === 'setup' || !tournament) {
    return (
      <SetupForm
        locale={locale}
        onToggleLocale={toggleLocale}
        onNext={handleSetupNext}
      />
    )
  }

  // ---- Render players ----
  if (screen === 'players') {
    return (
      <PlayerEntry
        settings={tournament.settings}
        locale={locale}
        onBack={() => { clearTournament(); setTournament(null) }}
        onStart={handlePlayersStart}
      />
    )
  }

  // ---- Loading: schedule being generated ----
  if (tournament.rounds.length === 0) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner" />
          <p className="loading-msg">{sv ? 'Genererar schema…' : 'Generating schedule…'}</p>
        </div>
      </div>
    )
  }

  // ---- Tournament view ----
  const { rounds, players, settings } = tournament
  const firstIncomplete = rounds.findIndex(r => r.games.some(g => !g.score))
  const currentRoundIndex = firstIncomplete >= 0 ? firstIncomplete : rounds.length - 1
  const currentRound = rounds[currentRoundIndex]
  const currentRoundComplete = currentRound.games.every(g => g.score != null)
  const allRoundsComplete = firstIncomplete === -1
  const standings = calculateStandings(tournament)

  return (
    <div className={`app ${displayMode ? 'display-mode' : ''}`}>
      {/* Header */}
      <div className="tournament-header">
        <div className="header-left">
          {!displayMode && (
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(true)}>
              {sv ? '← Ny' : '← New'}
            </button>
          )}
        </div>
        <div className="header-center">
          {settings.tournamentName && (
            <span className="tournament-name-header">{settings.tournamentName}</span>
          )}
          <span className="round-indicator">
            {sv ? `Omgång ${currentRoundIndex + 1} / ${settings.numRounds}` : `Round ${currentRoundIndex + 1} / ${settings.numRounds}`}
          </span>
          <span className="build-time-header">{new Date(__BUILD_TIME__).toLocaleTimeString('sv-SE')}</span>
        </div>
        <div className="header-right">
          {!displayMode && (
            <button className="flag-btn" onClick={toggleLocale} aria-label="Switch language">
              <FlagIcon locale={locale === 'sv' ? 'en' : 'sv'} size={24} />
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setDisplayMode(d => !d)}>
            {displayMode ? (sv ? '✎ Redigera' : '✎ Edit') : (sv ? '⛶ Visa' : '⛶ Display')}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      {!displayMode && (
        <div className="tab-bar">
          <button className={`tab ${activeTab === 'round' ? 'active' : ''}`} onClick={() => setActiveTab('round')}>
            {sv ? 'Omgång' : 'Round'}
          </button>
          <button className={`tab ${activeTab === 'standings' ? 'active' : ''}`} onClick={() => setActiveTab('standings')}>
            {sv ? 'Tabell' : 'Standings'}
          </button>
          <button className={`tab ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
            {sv ? 'Analys' : 'Analysis'}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="tournament-content">
        {(displayMode || activeTab === 'round') && (
          <RoundView
            round={currentRound}
            players={players}
            locale={locale}
            isComplete={currentRoundComplete}
            displayMode={displayMode}
            onScoreSubmit={(gameIdx, score) => handleScoreSubmit(currentRoundIndex, gameIdx, score)}
            onScoreClear={(gameIdx) => handleScoreClear(currentRoundIndex, gameIdx)}
          />
        )}

        {!displayMode && activeTab === 'standings' && standings.some(s => s.gamesPlayed > 0) && (
          <StandingsTable standings={standings} locale={locale} />
        )}
        {!displayMode && activeTab === 'standings' && standings.every(s => s.gamesPlayed === 0) && (
          <p className="empty-msg">{sv ? 'Inga resultat ännu' : 'No results yet'}</p>
        )}

        {!displayMode && activeTab === 'analysis' && (
          <ScheduleAnalysis tournament={tournament} locale={locale} />
        )}

        {displayMode && currentRoundComplete && (
          <StandingsTable standings={standings} locale={locale} />
        )}
      </div>

      {/* Action bar */}
      {!displayMode && (
        <div className="action-bar">
          {allRoundsComplete ? (
            <div className="tournament-complete">
              <h2>{sv ? '🏆 Turneringen är klar!' : '🏆 Tournament complete!'}</h2>
              <div className="complete-actions">
                <button className="btn btn-primary btn-full" onClick={() => downloadResultsPDF(tournament)}>
                  {sv ? '⬇ Ladda ner slutresultat (PDF)' : '⬇ Download final results (PDF)'}
                </button>
                <button className="btn btn-secondary btn-full" onClick={() => setConfirmReset(true)}>
                  {sv ? 'Ny turnering' : 'New tournament'}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-secondary btn-full" onClick={() => downloadSchedulePDF(tournament)}>
              {sv ? '⬇ Ladda ner schema (PDF)' : '⬇ Download schedule (PDF)'}
            </button>
          )}
        </div>
      )}

      {/* Confirm reset dialog */}
      {confirmReset && (
        <div className="dialog-overlay" onClick={() => setConfirmReset(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>{sv ? 'Ny turnering?' : 'New tournament?'}</h3>
            <p>{sv ? 'All data raderas. Är du säker?' : 'All data will be deleted. Are you sure?'}</p>
            <div className="dialog-buttons">
              <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                {sv ? 'Avbryt' : 'Cancel'}
              </button>
              <button className="btn btn-danger" onClick={handleReset}>
                {sv ? 'Ja, börja om' : 'Yes, reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
