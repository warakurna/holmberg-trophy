import { Tournament, Locale } from '../types'

// Storage abstraction — swap implementation here to upgrade to Firebase
const TOURNAMENT_KEY = 'holmberg_tournament'
const LOCALE_KEY = 'holmberg_locale'

export function saveTournament(t: Tournament): void {
  localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(t))
}

export function loadTournament(): Tournament | null {
  const raw = localStorage.getItem(TOURNAMENT_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as Tournament } catch { return null }
}

export function clearTournament(): void {
  localStorage.removeItem(TOURNAMENT_KEY)
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale)
}

export function loadLocale(): Locale {
  return localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'sv'
}
