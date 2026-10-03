import { useEffect, useRef, useState } from 'react';
import type { SourceFile } from './source-file';

// File bytes do not belong in localStorage: one ordinary PDF can exceed its
// quota and prevent recovery of the whole form. Keep a company-scoped cache.
function access(key: string, files?: SourceFile[]): Promise<SourceFile[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('entix-purchase-draft-files', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('files', files ? 'readwrite' : 'readonly');
      const request = files ? (files.length ? tx.objectStore('files').put({ files, at: Date.now() }, key) : tx.objectStore('files').delete(key)) : tx.objectStore('files').get(key);
      tx.oncomplete = () => { const saved = request.result; db.close(); resolve(files || (saved && Date.now() - saved.at < 14 * 86400000 ? saved.files : [])); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

export function usePurchaseDraftFiles(scope: string | null) {
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const queue = useRef(Promise.resolve());
  const cleared = useRef(false);
  const key = `${scope || 'no-org'}:purchase:new`;
  useEffect(() => {
    let active = true;
    access(key).then(saved => { if (active) setFiles(saved); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [key]);
  useEffect(() => {
    if (!ready || cleared.current) return;
    queue.current = queue.current.then(() => access(key, files)).then(() => setFailed(false)).catch(() => setFailed(true));
  }, [files, ready, key]);
  const clear = () => {
    cleared.current = true;
    queue.current = queue.current.then(() => access(key, [])).then(() => {}).catch(() => setFailed(true));
  };
  return { files, setFiles, ready, failed, clear };
}
