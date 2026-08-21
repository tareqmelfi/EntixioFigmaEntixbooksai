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
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('entix-language')) || 'en'
  return { 'Accept-Language': lang === 'ar' ? 'ar-SA,ar;q=0.9,en;q=0.8' : 'en-US,en;q=0.9,ar;q=0.8' }
}

export interface User {
  id: string
  email: string
  name: string
  company: string
  role: 'admin' | 'accountant' | 'viewer'
  avatar?: string
  locale?: 'ar' | 'en'
  /** false = verification link not clicked yet (soft-gate banner shows). */
  emailVerified?: boolean
  createdAt: string
  /** ISO timestamp when account deletion was requested (null = healthy). */
  deletionRequestedAt?: string | null
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  /** Authenticated but owns/joins zero orgs → routed to the /welcome chooser. */
  needsOnboarding?: boolean
}

export function isDemoMembership(membership: { org?: { demoExpiresAt?: string | null } | null } | null | undefined): boolean {
  return membership?.org?.demoExpiresAt != null
}

const USER_CACHE_KEY = 'entix_user_cache'

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

  async updateLocale(locale: 'ar' | 'en'): Promise<void> {
    if (!this.state.isAuthenticated || this.state.user?.locale === locale) return
    if (this.state.user) {
      this.state = { ...this.state, user: { ...this.state.user, locale } }
      writeCachedUser(this.state.user)
      this.notify()
    }
    try {
      await fetch(`${API_BASE}/me/preferences`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      })
    } catch {}
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
        // Sort memberships by createdAt ascending so the user's FIRST (oldest)
        // org is preferred — this is their real company, not a demo org.
        const sorted = [...memberships].sort((a: any, b: any) =>
          new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime()
        )
        // Demo identity is explicit server state; names and slugs are ordinary labels.
        const isDemo = isDemoMembership
        // Cross-platform truth: the server-side selection (User.selectedOrgId)
        // is written by ANY platform on an explicit pick (validated against
        // membership server-side). It always wins over the local copy so web
        // and iOS show the SAME company for the same user.
        const serverOrgId: string | null = me?.selectedOrgId || null
        const serverMatch = serverOrgId
          ? sorted.find((m: any) => m?.org?.id === serverOrgId)
          : null
        // STARRED default company (User.defaultOrgId) — the durable landing
        // org pinned via the OrgSwitcher star. Beats the last-active
        // selectedOrgId so sign-in always lands on the pinned company, even
        // after browsing others. Only a FRESH explicit pick (<5 min) outranks
        // it within a session.
        const pinnedOrgId: string | null = me?.defaultOrgId || null
        const pinnedMatch = pinnedOrgId
          ? sorted.find((m: any) => m?.org?.id === pinnedOrgId)
          : null
        const storedOrgId = typeof localStorage !== 'undefined'
          ? localStorage.getItem('entix_org_id') : null
        const storedMatch = storedOrgId
          ? sorted.find((m: any) => m?.org?.id === storedOrgId)
          : null
        // An explicit pick via the OrgSwitcher sets entix_org_explicit — that
        // choice is ALWAYS honored, even for demo orgs (the user clicked it).
        // The flag is wiped on login/logout by clearStaleState().
        const explicitPick = typeof localStorage !== 'undefined'
          ? localStorage.getItem('entix_org_explicit') : null
        // FRESH explicit pick wins over the server copy: if the user picked an
        // org moments ago but the server write raced/failed, the server still
        // holds the OLD org. Trusting the server blindly then bounced the user
        // back on every reload ("switcher does nothing" bug). A fresh (<5 min)
        // explicit pick is by definition the user's latest intent — honor it
        // and heal the server below.
        const explicitTs = explicitPick ? Number(explicitPick) : 0
        const freshLocalPick =
          storedMatch && explicitTs > 0 && Date.now() - explicitTs < 5 * 60_000
            ? storedMatch
            : null
        const serverWins = serverMatch && (!freshLocalPick || freshLocalPick.org?.id === serverMatch.org?.id)
        // If the stored org is a demo org WITHOUT an explicit pick, prefer the
        // oldest non-demo org instead. This fixes the case where a stale demo
        // id from a previous session hid the user's real company data.
        const storedIsDemo = storedMatch && isDemo(storedMatch) && !explicitPick
        const oldestReal = sorted.find((m: any) => !isDemo(m))
        const ownerMatch = !storedMatch || storedIsDemo
          ? (oldestReal || sorted.find((m: any) => m?.role === 'OWNER'))
          : null
        let activeMembership =
          freshLocalPick ||
          pinnedMatch ||
          (serverWins ? serverMatch : null) ||
          (storedIsDemo ? null : storedMatch) ||
          ownerMatch ||
          sorted[0]

        // Zero orgs = first-run chooser territory (2026-08-21 redesign). We NO
        // LONGER auto-bootstrap a silent «شركتي · SA/SAR» org — that default
        // dropped users into the wrong country/currency and hid their intent.
        // The /welcome page (company with country · or a demo) creates it.
        const needsOnboarding = !activeMembership

        if (activeMembership?.org?.id) {
          setOrgId(activeMembership.org.id)
          // Keep the server-side selection in sync when we resolved to a
          // different org than the one stored on the profile (first login,
          // fallback path, or membership change). Best-effort fire-and-forget.
          if (activeMembership.org.id !== serverOrgId) {
            fetch(`${API_BASE}/me/preferences`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ selectedOrgId: activeMembership.org.id }),
            }).catch(() => {})
          }
        }

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
          locale: me?.locale === 'ar' || me?.locale === 'en' ? me.locale : undefined,
          // Soft-gate: false until the verification link is clicked — drives
          // the persistent in-app banner (users enter immediately on signup).
          emailVerified: data.user.emailVerified !== false,
          createdAt: data.user.createdAt,
          // 30-day deletion grace: when set, the AuthGuard swaps the whole
          // app for the restore screen (cancel → full recovery).
          deletionRequestedAt: me?.deletionRequestedAt || null,
        }
        writeCachedUser(newUser)
        this.state = { user: newUser, isAuthenticated: true, loading: false, needsOnboarding }
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
        // Clear org-scoped data caches — but keep device-level preferences
        // (consent choice, language, marketing region are per-device, not per-user)
        const DEVICE_KEYS = new Set(['entix_token', 'entix-language', 'entix-marketing-region', 'entix_cookie_consent_v1'])
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('entix_') && !DEVICE_KEYS.has(key)) {
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
      if (error) {
        const code = (error as any)?.code
        const message = (error.message || '').toLowerCase()
        if (
          code === 'EMAIL_NOT_VERIFIED' ||
          message.includes('email not verified') ||
          message.includes('verify your email') ||
          message.includes('not verified')
        ) {
          return {
            success: false,
            code: 'EMAIL_NOT_VERIFIED',
            error: 'هذا البريد غير مُفعّل بعد. تحقق من بريدك أو أعد إرسال رسالة التفعيل.',
          }
        }
        return { success: false, error: error.message || 'فشل تسجيل الدخول', code }
      }
      if (!data) return { success: false, error: 'حدث خطأ غير متوقع' }
      await this.refresh()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل الاتصال بالخادم' }
    }
  }

  /** Email + password sign-up — the person only; orgs come from /welcome. The
   *  `company`/`country` params remain for the hard-gate stash path only. */
  async register(
    email: string,
    password: string,
    name: string,
    _company: string,
    captchaToken?: string | null,
    country?: 'SA' | 'US',
  ): Promise<{ success: boolean; error?: string; code?: string }> {
    try {
      const opts = captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : undefined
      const { data, error } = await authClient.signUp.email({ email, password, name }, opts)
      if (error) {
        if (error.code === 'USER_ALREADY_EXISTS' || (error.message || '').toLowerCase().includes('already')) {
          return { success: false, error: 'البريد الإلكتروني مسجل مسبقاً' }
        }
        return { success: false, error: error.message || 'فشل إنشاء الحساب', code: (error as any)?.code }
      }
      if (!data) return { success: false, error: 'حدث خطأ غير متوقع' }

      const user = (data as any)?.user
      // Soft-gate (2026-08-21): the server issues a session on signup even when
      // the email is unverified — the user enters immediately and the in-app
      // banner nags them to verify. The blocking panel below is kept ONLY for
      // hard-gate mode (BLOCK_UNVERIFIED_SIGNIN=true), where signup returns no
      // session token at all.
      const hasSession = typeof (data as any)?.token === 'string' && (data as any).token.length > 0
      const requiresVerification = user && user.emailVerified === false && !hasSession
      if (requiresVerification) {
        // Verification-required signups must NOT bootstrap an org or continue
        // into /app. The chosen country survives via localStorage and is
        // consumed by the first-org bootstrap after the verified sign-in.
        try { if (country) localStorage.setItem('entix_pending_org_country', country) } catch {}
        return { success: true, code: 'EMAIL_VERIFICATION_REQUIRED' }
      }

      // No org creation at signup (2026-08-21): registration is the PERSON
      // only (name · email · password). The first-run /welcome chooser creates
      // the first org deliberately (company+country · or demo) — a silent
      // «شركتي · SA» default landed users in the wrong jurisdiction and lost
      // the company name they typed.
      await this.refresh()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل الاتصال بالخادم' }
    }
  }

  /**
   * First-run chooser action — creates the user's first org (real company that
   * starts at zero, or an expiring demo) then refreshes auth state so the app
   * routes unlock. Idempotent server-side: an existing org is returned as-is.
   */
  async bootstrapOrg(input: { companyName?: string; country: 'SA' | 'US'; mode: 'company' | 'demo' }): Promise<{ ok: boolean; demo?: boolean }> {
    const res = await fetch(`${API_BASE}/me/bootstrap`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...localeHeaders() },
      body: JSON.stringify(input),
    })
    if (!res.ok) return { ok: false }
    const json = await res.json().catch(() => null)
    if (json?.org?.id) setOrgId(json.org.id)
    await this.refresh()
    return { ok: true, demo: json?.demo === true }
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
        body: JSON.stringify({ email, callbackURL: callbackURL || `${window.location.origin}/verify-email` }),
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
