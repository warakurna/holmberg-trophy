import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Tournament, Player } from '../types'
import { calculateStandings } from './standings'

function toFilename(name: string): string {
  return name.trim().replace(/[\\/:"*?<>|]+/g, '').replace(/\s+/g, '-') || 'holmberg-trophy'
}

function visibleNames(ids: number[], players: Player[], botIds: Set<number>, sep = ', '): string {
  return ids
    .filter(id => !botIds.has(id))
    .map(id => players.find(p => p.id === id)?.name ?? `#${id}`)
    .join(sep)
}

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

function pdfHeader(doc: jsPDF, tournament: Tournament, subtitle: string) {
  const { tournamentName, tournamentDate } = tournament.settings
  const title = tournamentName || 'Holmberg Trophy'
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 105, 18, { align: 'center' })
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  const datePart = tournamentDate ? `  ·  ${tournamentDate}` : ''
  doc.text(subtitle + datePart, 105, 26, { align: 'center' })
}

export function downloadSchedulePDF(tournament: Tournament) {
  const doc = new jsPDF()
  const sv = tournament.locale === 'sv'
  const botIds = new Set(tournament.players.filter(p => p.isBot).map(p => p.id))

  pdfHeader(doc, tournament, sv ? 'Spelschema' : 'Tournament Schedule')

  let y = 36

  for (const round of tournament.rounds) {
    if (y > 252) { doc.addPage(); y = 16 }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(`${sv ? 'Omgång' : 'Round'} ${round.roundNumber}`, 14, y)
    y += 5

    const body = round.games.map(g => {
      const t1 = visibleNames(g.team1.playerIds, tournament.players, botIds, '\n')
      const t2 = visibleNames(g.team2.playerIds, tournament.players, botIds, '\n')
      const t1size = g.team1.playerIds.filter(id => !botIds.has(id)).length
      const t2size = g.team2.playerIds.filter(id => !botIds.has(id)).length
      const label = t1size !== t2size ? `(${t1size}v${t2size})` : 'vs'
      return [`${sv ? 'Plan' : 'Court'} ${g.court}`, t1, label, t2]
    })

    autoTable(doc, {
      startY: y,
      head: [[sv ? 'Plan' : 'Court', sv ? 'Lag 1' : 'Team 1', '', sv ? 'Lag 2' : 'Team 2']],
      body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [21, 101, 192] },
      columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 12, halign: 'center' } },
      margin: { left: 14, right: 14 },
    })

    y = lastY(doc) + 4

    if (round.sitOutPlayerIds.length > 0) {
      const names = round.sitOutPlayerIds
        .map(id => tournament.players.find(p => p.id === id)?.name ?? `#${id}`)
        .join(', ')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`${sv ? 'Sitter av:' : 'Sitting out:'} ${names}`, 14, y)
      doc.setTextColor(0)
      y += 8
    } else {
      y += 4
    }
  }

  const base = toFilename(tournament.settings.tournamentName)
  doc.save(sv ? `${base}-schema.pdf` : `${base}-schedule.pdf`)
}

export function downloadResultsPDF(tournament: Tournament) {
  const doc = new jsPDF()
  const sv = tournament.locale === 'sv'
  const botIds = new Set(tournament.players.filter(p => p.isBot).map(p => p.id))

  pdfHeader(doc, tournament, sv ? 'Slutresultat' : 'Final Results')

  let y = 36

  for (const round of tournament.rounds) {
    if (y > 245) { doc.addPage(); y = 16 }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(`${sv ? 'Omgång' : 'Round'} ${round.roundNumber}`, 14, y)
    y += 5

    const body = round.games.map(g => {
      const t1 = visibleNames(g.team1.playerIds, tournament.players, botIds, '\n')
      const t2 = visibleNames(g.team2.playerIds, tournament.players, botIds, '\n')
      const score = g.score ? `${g.score.score1} – ${g.score.score2}` : '–'
      return [`${sv ? 'Plan' : 'Court'} ${g.court}`, t1, score, t2]
    })

    autoTable(doc, {
      startY: y,
      body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 22 },
        2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })

    y = lastY(doc) + 4

    if (round.sitOutPlayerIds.length > 0) {
      const names = round.sitOutPlayerIds
        .map(id => tournament.players.find(p => p.id === id)?.name ?? `#${id}`)
        .join(', ')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`${sv ? 'Sitter av:' : 'Sitting out:'} ${names}`, 14, y)
      doc.setTextColor(0)
      y += 8
    } else {
      y += 4
    }
  }

  if (y > 230) { doc.addPage(); y = 16 }

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(sv ? 'Slutställning' : 'Final Standings', 14, y)
  y += 6

  const standings = calculateStandings(tournament)
  const standingsBody = standings.map((s, i) => [
    String(i + 1),
    s.player.name,
    String(s.gamesPlayed),
    String(s.wins),
    String(s.losses),
    (s.differential > 0 ? '+' : '') + s.differential,
    s.avgPoints.toFixed(2),
  ])

  autoTable(doc, {
    startY: y,
    head: [['#', sv ? 'Spelare' : 'Player', 'GP', 'W', 'L', '+/-', 'Pts/G']],
    body: standingsBody,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [21, 101, 192] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  })

  const base = toFilename(tournament.settings.tournamentName)
  doc.save(sv ? `${base}-slutresultat.pdf` : `${base}-results.pdf`)
}
