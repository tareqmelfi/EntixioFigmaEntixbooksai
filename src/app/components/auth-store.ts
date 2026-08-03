/**
 * ENTIX.IO · Auth Store (better-auth backed)
 *
 * Same public API as the old localStorage-based store · same hook signature.
 * Internally uses better-auth REST endpoints + cookie sessions on api.entix.io.
 *
 * Pages don't need to change. Login/Register pages should use the async login()/register() instead of the old sync versions.
 */

import { authClient } from '../lib/auth-client'
import { setOrgId } from '../lib/api'

const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'https://api.entix.io'

function localeHeaders(): Record<string, string> {
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('entix-language')) || 'ar'
  return { 'Accept-Language': lang === 'en' ? 'en-US,en;q=0.9,ar;q=0.8' : 'ar-SA,ar;q=0.9,en;q=0.8' }
}

export interface User {
  id: string
  email: string
  name: string
  company: string
  role: 'admin' | 'accountant' | 'viewer'
  avatar?: string
  createdAt: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
}

const USER_CACHE_KEY = 'entix_user_cache'
const USER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function readCachedUser(): User | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(USER_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { user: User; ts: number }
    if (!parsed?.user?.id) return null
    if (Date.now() - parsed.ts > USER_CACHE_TTL_MS) return null
    return parsed.user
  } catch { return null }
}

function writeCachedUser(user: User | null) {
  try {
    if (typeof localStorage === 'undefined') return
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify({ user, ts: Date.now() }))
    else localStorage.removeItem(USER_CACHE_KEY)
  } catch {}
}

class AuthStore {
  private state: AuthState
  private listeners = new Set<(state: AuthState) => void>()

  constructor() {
    // SECURITY: Do NOT optimistically hydrate from cache. The cached user
    // may belong to a previous session (different Google account, or a
    // user who closed the tab without logging out). Rendering their data
    // before the server confirms the session leaks another user's info.
    // Always start in a loading state and let refresh() determine the truth.
    this.state = { user: null, isAuthenticated: false, loading: true }
    this.refresh()
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.state))
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): AuthState {
    return this.state
  }

  /** Reload session from /api/auth/get-session */
  async refresh(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/get-session`, {
        credentials: 'include',
        headers: localeHeaders(),
      })
      if (!res.ok) {
        writeCachedUser(null)
        this.state = { user: null, isAuthenticated: false, loading: false }
        this.notify()
        return
      }
      const data = await res.json()
      if (data?.user?.id) {
        // Pull org info via /me
        const meRes = await fetch(`${API_BASE}/me`, { credentials: 'include', headers: localeHeaders() })
        const me = meRes.ok ? await meRes.json() : null
        const memberships = me?.memberships || []
        // Resolve the active org for this session.
        // 1. If the user previously selected an org (stored in localStorage),
        //    honor it — but ONLY if it's in the server-confirmed membership list.
        //    This is safe because we've already validated the session and fetched
        //    memberships from the server. clearStaleState() wipes the stored id
        //    on login/logout, so a different user's org_id can never leak through.
        // 2. Prefer an org where the user is OWNER (their personal org) over
        //    shared/demo orgs where they might be VIEWER/ACCOUNTANT.
        // 3. Fall back to the first membership from the server.
        const storedOrgId = typeof localStorage !== 'undefined'
          ? localStorage.getItem('entix_org_id') : null
        const storedMatch = storedOrgId
          ? memberships.find((m: any) => m?.org?.id === storedOrgId)
          : null
        const ownerMatch = !storedMatch
          ? memberships.find((m: any) => m?.role === 'OWNER')
          : null
        let activeMembership = storedMatch || ownerMatch || memberships[0]

        // First login via Google can arrive with zero orgs.
        // Auto-bootstrap a seeded demo org so app routes never crash with missing X-Org-Id.
        // Retry up to 2 times — the seeding (accounts, demo data) can occasionally
        // fail on the first attempt due to DB contention. Without a successful
        // bootstrap, orgId stays null and every org-scoped API call returns 400.
        if (!activeMembership) {
          for (let attempt = 0; attempt < 2 && !activeMembership; attempt++) {
            try {
              const bootstrapRes = await fetch(`${API_BASE}/me/bootstrap`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...localeHeaders() },
              })
              if (bootstrapRes.ok) {
                const boot = await bootstrapRes.json().catch(() => null)
                if (boot?.org?.id) {
                  activeMembership = {
                    org: boot.org,
                    role: boot.role || 'OWNER',
                  }
                }
              } else if (attempt === 1) {
                // Log the failure on the final attempt so it's visible in console
                console.error('[auth] bootstrap failed:', bootstrapRes.status, await bootstrapRes.text().catch(() => ''))
              }
            } catch (e) {
              if (attempt === 1) console.error('[auth] bootstrap error:', e)
            }
          }
        }

        if (activeMembership?.org?.id) setOrgId(activeMembership.org.id)

        const resolvedRole = activeMembership?.role?.toLowerCase?.()
        const newUser: User = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || '',
          company: activeMembership?.org?.name || '',
          role: resolvedRole === 'owner' || resolvedRole === 'admin'
            ? 'admin'
            : resolvedRole === 'accountant'
              ? 'accountant'
              : 'viewer',
          avatar: data.user.image || undefined,
          createdAt: data.user.createdAt,
        }
        writeCachedUser(newUser)
        this.state = { user: newUser, isAuthenticated: true, loading: false }
      } else {
        writeCachedUser(null)
        this.state = { user: null, isAuthenticated: false, loading: false }
      }
      this.notify()
    } catch (e) {
      console.error('[auth] refresh failed', e)
      this.state = { user: null, isAuthenticated: false, loading: false }
      this.notify()
    }
  }

  /** Clear any stale state from a previous user's session.
   *  Must be called BEFORE starting a new login flow to prevent
   *  data leakage between users (e.g. Google account switch). */
  private clearStaleState() {
    setOrgId(null)
    writeCachedUser(null)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('entix_auth_hint')
        // Clear org-scoped data caches
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('entix_') && key !== 'entix_token') {
            localStorage.removeItem(key)
          }
        }
      }
    } catch {}
  }

  /** Email + password sign-in */
  async login(email: string, password: string, captchaToken?: string | null): Promise<{ success: boolean; error?: string; code?: string }> {
    this.clearStaleState()
    try {
      const opts = captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : undefined
      const { data, error } = await authClient.signIn.email({ email, password }, opts)
      if (error) return { success: false, error: error.message || 'فشل تسجيل الدخول', code: (error as any)?.code }
      if (!data) return { success: false, error: 'حدث خطأ غير متوقع' }
      await this.refresh()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل الاتصال بالخادم' }
    }
  }

  /** Email + password sign-up · auto-creates first org */
  async register(
    email: string,
    password: string,
    name: string,
    company: string,
    captchaToken?: string | null,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const opts = captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : undefined
      const { data, error } = await authClient.signUp.email({ email, password, name }, opts)
      if (error) {
        if (error.code === 'USER_ALREADY_EXISTS' || (error.message || '').toLowerCase().includes('already')) {
          return { success: false, error: 'البريد الإلكتروني مسجل مسبقاً' }
        }
        return { success: false, error: error.message || 'فشل إنشاء الحساب' }
      }
      if (!data) return { success: false, error: 'حدث خطأ غير متوقع' }

      // Bootstrap first org for the new user.
      // Company is optional — if empty, the backend creates a default
      // org named after the user. The user can rename it later.
      const companyName = company.trim()
      if (companyName) {
        const bootstrapRes = await fetch(`${API_BASE}/me/bootstrap`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName }),
        })
        if (bootstrapRes.ok) {
          const json = await bootstrapRes.json()
          if (json?.org?.id) setOrgId(json.org.id)
        }
      } else {
        // No company name — still bootstrap a default org so the user
        // doesn't get "missing X-Org-Id" errors on the dashboard.
        const bootstrapRes = await fetch(`${API_BASE}/me/bootstrap`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (bootstrapRes.ok) {
          const json = await bootstrapRes.json()
          if (json?.org?.id) setOrgId(json.org.id)
        }
      }

      await this.refresh()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل الاتصال بالخادم' }
    }
  }

  /** Cached `/auth-providers` response */
  private providers: { emailPassword: boolean; google: boolean; microsoft: boolean } | null = null

  async getProviders() {
    if (this.providers) return this.providers
    try {
      const res = await fetch(`${API_BASE}/auth-providers`)
      this.providers = await res.json()
    } catch {
      this.providers = { emailPassword: true, google: false, microsoft: false }
    }
    return this.providers!
  }

  /** Google OAuth sign-in (browser redirect) */
  async loginWithGoogle(callbackURL?: string): Promise<{ success: boolean; error?: string }> {
    // SECURITY: Clear stale state BEFORE redirecting to Google.
    // If another user was logged in before, their org_id and cached user
    // would persist through the redirect and leak into the new session.
    this.clearStaleState()
    const p = await this.getProviders()
    if (!p.google) {
      return {
        success: false,
        error: 'Google sign-in is not available yet. Please use email and password.',
      }
    }
    await authClient.signIn.social({
      provider: 'google',
      // Use an explicit production URL instead of window.location.origin, which
      // resolves to a capacitor/webview origin on mobile (e.g. capacitor://localhost)
      // and breaks the OAuth redirect + cross-subdomain session cookie.
      callbackURL: callbackURL || 'https://entix.io/app',
    })
    return { success: true }
  }

  /** Microsoft OAuth sign-in (browser redirect) */
  async loginWithMicrosoft(callbackURL?: string): Promise<{ success: boolean; error?: string }> {
    this.clearStaleState()
    const p = await this.getProviders()
    if (!p.microsoft) {
      return {
        success: false,
        error: 'Microsoft sign-in is not available yet. Please use email and password.',
      }
    }
    await authClient.signIn.social({
      provider: 'microsoft',
      callbackURL: callbackURL || 'https://entix.io/app',
    })
    return { success: true }
  }

  /** Send password-reset email · better-auth flow */
  async requestPasswordReset(email: string, captchaToken?: string | null): Promise<{ success: boolean; error?: string; status?: number }> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(captchaToken ? { 'x-captcha-response': captchaToken } : {}),
        },
        body: JSON.stringify({
          email,
          redirectTo: 'https://entix.io/reset-password',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { success: false, status: res.status, error: data?.message || 'فشل إرسال رابط الاسترداد' }
      }
      if (data?.status !== true) {
        return { success: false, status: res.status, error: data?.message || 'تعذر إتمام الطلب الآن' }
      }
      return { success: true, status: res.status }
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل الاتصال بالخادم' }
    }
  }

  async resendVerificationEmail(email: string, callbackURL?: string): Promise<{ success: boolean; error?: string; status?: number }> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-verification-email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, callbackURL: callbackURL || `${window.location.origin}/login` }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { success: false, status: res.status, error: data?.message || 'فشل إرسال رسالة التحقق' }
      }
      if (data?.status !== true) {
        return { success: false, status: res.status, error: data?.message || 'تعذر إرسال رسالة التحقق' }
      }
      return { success: true, status: res.status }
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل الاتصال بالخادم' }
    }
  }

  /** Reset password using a token from the email link */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { success: false, error: data?.message || 'الرابط منتهي أو غير صالح' }
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل الاتصال بالخادم' }
    }
  }

  /** Sign out · clears server session + cookie + local caches */
  async logout(): Promise<void> {
    try {
      await authClient.signOut()
    } catch (e) {
      console.error('[auth] logout failed', e)
    }
    setOrgId(null)
    writeCachedUser(null)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('entix_auth_hint')
      }
    } catch {}
    this.state = { user: null, isAuthenticated: false, loading: false }
    this.notify()
  }
}

export const authStore = new AuthStore()
