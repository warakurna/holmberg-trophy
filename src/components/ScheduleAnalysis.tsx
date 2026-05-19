import { Tournament, Player, Locale } from '../types'
import { analyzeSchedule } from '../utils/analysis'

interface Props {
  tournament: Tournament
  locale: Locale
}

function shortName(p: Player) {
  return p.name.split(' ')[0]
}

export function ScheduleAnalysis({ tournament, locale }: Props) {
  const sv = locale === 'sv'
  const { players } = tournament
  const stats = analyzeSchedule(tournament)

  function getPair(a: number, b: number) {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`
    return stats.get(k) ?? { together: 0, against: 0 }
  }

  return (
    <div className="analysis-wrapper">
      <p className="analysis-legend">
        <span className="pair-with-label">{sv ? 'Med' : 'With'}</span>
        {' / '}
        <span className="pair-against-label">{sv ? 'Mot' : 'Against'}</span>
        {sv ? ' — antal gånger' : ' — number of times'}
      </p>
      <div className="analysis-scroll">
        <table className="analysis-table">
          <thead>
            <tr>
              <th className="analysis-corner"></th>
              {players.map(p => (
                <th key={p.id} className="analysis-col-head" title={p.name}>
                  {shortName(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map(rowP => (
              <tr key={rowP.id}>
                <td className="analysis-row-head" title={rowP.name}>
                  {shortName(rowP)}
                </td>
                {players.map(colP => {
                  if (rowP.id === colP.id) {
                    return <td key={colP.id} className="analysis-cell-self">—</td>
                  }
                  const pair = getPair(rowP.id, colP.id)
                  return (
                    <td key={colP.id} className="analysis-cell">
                      <span className="pair-with">{pair.together}</span>
                      <span className="pair-sep">/</span>
                      <span className="pair-against">{pair.against}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
