import { PlayerStanding } from '../utils/standings'
import { Locale } from '../types'

interface Props {
  standings: PlayerStanding[]
  locale: Locale
}

export function StandingsTable({ standings, locale }: Props) {
  const sv = locale === 'sv'

  return (
    <div className="standings-wrapper">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="col-name">{sv ? 'Spelare' : 'Player'}</th>
            <th title={sv ? 'Spelade' : 'Played'}>GP</th>
            <th title={sv ? 'Vinster' : 'Wins'}>W</th>
            <th title={sv ? 'Förluster' : 'Losses'}>L</th>
            <th title={sv ? 'Poängdifferens' : 'Point diff'}>+/-</th>
            <th title={sv ? 'Genomsnittspoäng per match' : 'Avg points per game'}>Pts/G</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.player.id} className={i === 0 ? 'top-row' : ''}>
              <td className="col-rank">{i + 1}</td>
              <td className="col-name">{s.player.name}</td>
              <td>{s.gamesPlayed}</td>
              <td>{s.wins}</td>
              <td>{s.losses}</td>
              <td className={s.differential >= 0 ? 'positive' : 'negative'}>
                {s.differential > 0 ? '+' : ''}{s.differential}
              </td>
              <td className="col-pts">{s.avgPoints.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
