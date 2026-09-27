import { useSyncExternalStore } from 'react';
import { authStore } from './auth-store';

const subscribe = (notify: () => void) => authStore.subscribe(notify);
const snapshot = () => authStore.getState();

/** Observe session updates even when refresh finishes between render and subscription. */
export function useAuthState() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
