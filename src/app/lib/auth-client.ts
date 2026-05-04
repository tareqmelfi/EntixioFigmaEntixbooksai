/**
 * better-auth React client
 *
 * Hooks: useSession() · authClient.signUp.email() · authClient.signIn.email() · authClient.signOut()
 *
 * Sessions are cookie-based · works automatically with credentials:'include' fetch.
 * No manual token management needed.
 */
import { createAuthClient } from 'better-auth/react'

const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'https://api.entix.io'

export const authClient = createAuthClient({
  baseURL: API_BASE,
})

export const { useSession, signIn, signUp, signOut, getSession } = authClient
