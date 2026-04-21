import { Locale } from '../types'

interface Props { locale: Locale; size?: number }

export function FlagIcon({ locale, size = 40 }: Props) {
  const w = size * (20 / 13), h = size
  if (locale === 'sv') {
    return (
      <svg width={w} height={h} viewBox="0 0 20 13">
        <rect width="20" height="13" fill="#006AA7" />
        <rect y="5" width="20" height="3" fill="#FECC02" />
        <rect x="6" width="3" height="13" fill="#FECC02" />
      </svg>
    )
  }
  return (
    <svg width={w} height={h} viewBox="0 0 60 40">
      <rect width="60" height="40" fill="#012169" />
      <line x1="0" y1="0" x2="60" y2="40" stroke="white" strokeWidth="8" />
      <line x1="60" y1="0" x2="0" y2="40" stroke="white" strokeWidth="8" />
      <line x1="0" y1="0" x2="60" y2="40" stroke="#C8102E" strokeWidth="4" />
      <line x1="60" y1="0" x2="0" y2="40" stroke="#C8102E" strokeWidth="4" />
      <rect x="24" y="0" width="12" height="40" fill="white" />
      <rect x="0" y="14" width="60" height="12" fill="white" />
      <rect x="26" y="0" width="8" height="40" fill="#C8102E" />
      <rect x="0" y="16" width="60" height="8" fill="#C8102E" />
    </svg>
  )
}
