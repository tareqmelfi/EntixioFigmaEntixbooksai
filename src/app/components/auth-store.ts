/**
 * Entix Books · Auth Store (better-auth backed)
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

class AuthStore {
  private state: AuthState = { user: null, isAuthenticated: false, loading: true }
  private listeners = new Set<(state: AuthState) => void>()

  constructor() {
    // Hydrate session from server on app boot
    this.refresh()
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.state))
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
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
        this.state = { user: null, isAuthenticated: false, loading: false }
        this.notify()
        return
      }
      const data = await res.json()
      if (data?.user?.id) {
        // Pull org info via /me
        const meRes = await fetch(`${API_BASE}/me`, { credentials: 'include' })
        const me = meRes.ok ? await meRes.json() : null
        const firstOrg = me?.memberships?.[0]
        if (firstOrg?.org?.id) setOrgId(firstOrg.org.id)

        this.state = {
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name || '',
            company: firstOrg?.org?.name || '',
            role: firstOrg?.role?.toLowerCase?.() === 'owner' ? 'admin' : (firstOrg?.role?.toLowerCase?.() || 'viewer'),
            avatar: data.user.image || undefined,
            createdAt: data.user.createdAt,
          },
          isAuthenticated: true,
          loading: false,
        }
      } else {
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
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await authClient.signIn.email({ email, password })
      if (error) return { success: false, error: error.message || 'فشل تسجيل الدخول' }
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

  /** Google OAuth sign-in (browser redirect) */
  async loginWithGoogle(): Promise<void> {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/app`,
    })
  }

  /** Sign out · clears server session + cookie */
  async logout(): Promise<void> {
    try {
      await authClient.signOut()
    } catch (e) {
      console.error('[auth] logout failed', e)
    }
    setOrgId(null)
    this.state = { user: null, isAuthenticated: false, loading: false }
    this.notify()
  }
}

export const authStore = new AuthStore()
