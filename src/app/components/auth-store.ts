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
    // Optimistic hydrate from cache · the server check still runs in background
    // and will revoke immediately if the cookie has actually expired.
    const cachedUser = readCachedUser()
    this.state = cachedUser
      ? { user: cachedUser, isAuthenticated: true, loading: true }
      : { user: null, isAuthenticated: false, loading: true }
    // Hydrate session from server on app boot
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
        const meRes = await fetch(`${API_BASE}/me`, { credentials: 'include' })
        const me = meRes.ok ? await meRes.json() : null
        const memberships = me?.memberships || []
        // Respect user's previously-selected org if still valid · fallback to first
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('entix_org_id') : null
        const matched = stored ? memberships.find((m: any) => m.org?.id === stored) : null
        let activeMembership = matched || memberships[0]

        // First login via Google can arrive with zero orgs.
        // Auto-bootstrap a seeded demo org so app routes never crash with missing X-Org-Id.
        if (!activeMembership) {
          try {
            const bootstrapRes = await fetch(`${API_BASE}/me/bootstrap`, {
              method: 'POST',
              credentials: 'include',
            })
            if (bootstrapRes.ok) {
              const boot = await bootstrapRes.json().catch(() => null)
              if (boot?.org?.id) {
                activeMembership = {
                  org: boot.org,
                  role: boot.role || 'OWNER',
                }
              }
            }
          } catch {
            // Keep graceful fallback below (viewer with empty company).
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

  /** Email + password sign-in */
  async login(email: string, password: string): Promise<{ success: boolean; error?: string; code?: string }> {
    try {
      const { data, error } = await authClient.signIn.email({ email, password })
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
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await authClient.signUp.email({ email, password, name })
      if (error) {
        if (error.code === 'USER_ALREADY_EXISTS' || (error.message || '').toLowerCase().includes('already')) {
          return { success: false, error: 'البريد الإلكتروني مسجل مسبقاً' }
        }
        return { success: false, error: error.message || 'فشل إنشاء الحساب' }
      }
      if (!data) return { success: false, error: 'حدث خطأ غير متوقع' }

      // Bootstrap first org for the new user
      const bootstrapRes = await fetch(`${API_BASE}/me/bootstrap`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: company }),
      })
      if (bootstrapRes.ok) {
        const json = await bootstrapRes.json()
        if (json?.org?.id) setOrgId(json.org.id)
      }

      await this.refresh()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل الاتصال بالخادم' }
    }
  }

  /** Cached `/auth-providers` response */
  private providers: { emailPassword: boolean; google: boolean } | null = null

  async getProviders() {
    if (this.providers) return this.providers
    try {
      const res = await fetch(`${API_BASE}/auth-providers`)
      this.providers = await res.json()
    } catch {
      this.providers = { emailPassword: true, google: false }
    }
    return this.providers!
  }

  /** Google OAuth sign-in (browser redirect) */
  async loginWithGoogle(callbackURL?: string): Promise<{ success: boolean; error?: string }> {
    const p = await this.getProviders()
    if (!p.google) {
      return {
        success: false,
        error: 'تسجيل الدخول عبر Google غير مفعّل بعد · يرجى استخدام البريد وكلمة المرور',
      }
    }
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: callbackURL || `${window.location.origin}/app`,
    })
    return { success: true }
  }

  /** Send password-reset email · better-auth flow */
  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string; status?: number }> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
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
