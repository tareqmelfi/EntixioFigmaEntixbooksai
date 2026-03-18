/**
 * Entix Books — Data Service Layer (Repository Pattern)
 * ─────────────────────────────────────────────────────
 * Architecture: All data access goes through this abstraction layer.
 * 
 * Current: localStorage (offline-first)
 * Future:  Switch to VPS API (PostgreSQL/MySQL) with local cache + daily sync
 * 
 * The DataService interface ensures all code uses the same contract,
 * making the backend swap seamless (just change the implementation).
 * 
 * Sync Strategy:
 * - Local storage is the primary source (works offline)
 * - syncToServer() pushes local changes to VPS
 * - syncFromServer() pulls latest from VPS
 * - Auto-sync can be scheduled (e.g., end of day)
 * - Conflict resolution: last-write-wins with timestamps
 */

export interface SyncStatus {
  lastSyncAt: string | null;
  pendingChanges: number;
  isOnline: boolean;
  syncMode: 'manual' | 'auto' | 'realtime';
}

export interface DataRecord {
  id: string;
  updatedAt: string;
  createdAt: string;
  _synced?: boolean;
  _deleted?: boolean;
  [key: string]: unknown;
}

// Generic repository interface — all data modules implement this
export interface IRepository<T extends DataRecord> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  query(filter: Partial<T>): Promise<T[]>;
}

// LocalStorage implementation
class LocalStorageRepository<T extends DataRecord> implements IRepository<T> {
  constructor(private collectionName: string) {}

  private getStore(): T[] {
    try {
      const raw = localStorage.getItem(`entix_${this.collectionName}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private saveStore(data: T[]): void {
    localStorage.setItem(`entix_${this.collectionName}`, JSON.stringify(data));
    // Mark pending sync
    const pending = parseInt(localStorage.getItem('entix_pending_changes') || '0');
    localStorage.setItem('entix_pending_changes', String(pending + 1));
  }

  async getAll(): Promise<T[]> {
    return this.getStore().filter(r => !r._deleted);
  }

  async getById(id: string): Promise<T | null> {
    return this.getStore().find(r => r.id === id && !r._deleted) || null;
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString();
    const record = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      _synced: false,
    } as T;
    const store = this.getStore();
    store.push(record);
    this.saveStore(store);
    return record;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const store = this.getStore();
    const idx = store.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`Record ${id} not found`);
    store[idx] = { ...store[idx], ...data, updatedAt: new Date().toISOString(), _synced: false };
    this.saveStore(store);
    return store[idx];
  }

  async delete(id: string): Promise<void> {
    const store = this.getStore();
    const idx = store.findIndex(r => r.id === id);
    if (idx === -1) return;
    store[idx] = { ...store[idx], _deleted: true, _synced: false, updatedAt: new Date().toISOString() };
    this.saveStore(store);
  }

  async query(filter: Partial<T>): Promise<T[]> {
    const all = await this.getAll();
    return all.filter(record => {
      return Object.entries(filter).every(([key, value]) => record[key] === value);
    });
  }
}

// ─── Data Service Singleton ───
class DataService {
  private repos = new Map<string, LocalStorageRepository<any>>();

  getRepository<T extends DataRecord>(collection: string): IRepository<T> {
    if (!this.repos.has(collection)) {
      this.repos.set(collection, new LocalStorageRepository<T>(collection));
    }
    return this.repos.get(collection)!;
  }

  getSyncStatus(): SyncStatus {
    return {
      lastSyncAt: localStorage.getItem('entix_last_sync'),
      pendingChanges: parseInt(localStorage.getItem('entix_pending_changes') || '0'),
      isOnline: navigator.onLine,
      syncMode: (localStorage.getItem('entix_sync_mode') as SyncStatus['syncMode']) || 'manual',
    };
  }

  setSyncMode(mode: SyncStatus['syncMode']): void {
    localStorage.setItem('entix_sync_mode', mode);
  }

  // Placeholder: Replace with actual VPS API call
  async syncToServer(): Promise<{ success: boolean; synced: number }> {
    // Future: POST all _synced=false records to VPS API
    // const unsyncedRecords = getAllUnsynced();
    // await fetch('https://your-vps.com/api/sync', { method: 'POST', body: JSON.stringify(unsyncedRecords) });
    console.log('[Entix Sync] Ready for VPS connection. Configure API_BASE_URL in environment.');
    const pending = parseInt(localStorage.getItem('entix_pending_changes') || '0');
    localStorage.setItem('entix_pending_changes', '0');
    localStorage.setItem('entix_last_sync', new Date().toISOString());
    return { success: true, synced: pending };
  }

  async syncFromServer(): Promise<{ success: boolean; received: number }> {
    // Future: GET latest records from VPS API
    // const serverData = await fetch('https://your-vps.com/api/sync/pull');
    console.log('[Entix Sync] Ready for VPS pull. Configure API_BASE_URL in environment.');
    return { success: true, received: 0 };
  }

  // Export all data as JSON (for backup / download)
  exportAllData(): string {
    const allData: Record<string, unknown[]> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('entix_') && !key.includes('sync') && !key.includes('pending') && !key.includes('auth')) {
        try {
          allData[key.replace('entix_', '')] = JSON.parse(localStorage.getItem(key) || '[]');
        } catch { /* skip non-JSON */ }
      }
    }
    return JSON.stringify(allData, null, 2);
  }

  // Import data from JSON backup
  importAllData(jsonString: string): void {
    const data = JSON.parse(jsonString);
    Object.entries(data).forEach(([collection, records]) => {
      localStorage.setItem(`entix_${collection}`, JSON.stringify(records));
    });
  }
}

export const dataService = new DataService();
