/**
 * Entix Books — Auth Store
 * Simple auth state management with localStorage persistence.
 * Future: Replace with VPS JWT/session-based auth.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  company: string;
  role: 'admin' | 'accountant' | 'viewer';
  avatar?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

// Default registered user
const DEFAULT_USERS: (User & { password: string })[] = [
  {
    id: 'usr_001',
    email: 'tareq@fc.sa',
    password: 'Hh8787965',
    name: 'طارق',
    company: 'Entix Books',
    role: 'admin',
    createdAt: '2025-01-01T00:00:00Z',
  },
];

class AuthStore {
  private state: AuthState = { user: null, isAuthenticated: false };
  private listeners = new Set<(state: AuthState) => void>();

  constructor() {
    // Load stored users into localStorage if not present
    const storedUsers = localStorage.getItem('entix_users');
    if (!storedUsers) {
      localStorage.setItem('entix_users', JSON.stringify(DEFAULT_USERS));
    }
    // Restore session
    const session = localStorage.getItem('entix_session');
    if (session) {
      try {
        const user = JSON.parse(session);
        this.state = { user, isAuthenticated: true };
      } catch { /* invalid session */ }
    }
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): AuthState {
    return this.state;
  }

  private getUsers(): (User & { password: string })[] {
    try {
      return JSON.parse(localStorage.getItem('entix_users') || '[]');
    } catch { return []; }
  }

  login(email: string, password: string): { success: boolean; error?: string } {
    const users = this.getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return { success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    }
    const { password: _, ...userData } = user;
    this.state = { user: userData, isAuthenticated: true };
    localStorage.setItem('entix_session', JSON.stringify(userData));
    this.notify();
    return { success: true };
  }

  register(email: string, password: string, name: string, company: string): { success: boolean; error?: string } {
    const users = this.getUsers();
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'البريد الإلكتروني مسجل مسبقاً' };
    }
    const newUser = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      email,
      password,
      name,
      company,
      role: 'admin' as const,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem('entix_users', JSON.stringify(users));
    const { password: _, ...userData } = newUser;
    this.state = { user: userData, isAuthenticated: true };
    localStorage.setItem('entix_session', JSON.stringify(userData));
    this.notify();
    return { success: true };
  }

  logout(): void {
    this.state = { user: null, isAuthenticated: false };
    localStorage.removeItem('entix_session');
    this.notify();
  }
}

export const authStore = new AuthStore();
