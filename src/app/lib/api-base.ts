/**
 * Tiny, dependency-free slice of the API client used by PUBLIC pages
 * (root landing geo-resolve, error boundary). Kept separate so the 217KB
 * api.ts never ships in the public entry chunk (TBT · 2026-10-16).
 */
export const API_BASE_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'https://api.entix.io'

export function clientErrorRef(): string {
  return 'R-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase()
}
