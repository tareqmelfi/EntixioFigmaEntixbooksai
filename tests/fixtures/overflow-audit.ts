import type { Page } from '@playwright/test'

/**
 * Overflow audit (CEO 2026-09-08 · «راجع كل المربعات بلا استثناء»).
 * Returns every element whose content paints outside its own box or outside
 * its parent's box — the two ways columns and cards "overlap" on screen.
 * Intended scroll containers (overflow auto/scroll) are skipped.
 */
export type OverflowHit = { path: string; kind: 'spills-self' | 'spills-parent' | 'page-x-scroll'; by: number; text: string }

export async function auditOverflow(page: Page, root = 'main'): Promise<OverflowHit[]> {
  return page.evaluate((rootSel) => {
    const out: any[] = []
    const rootEl = document.querySelector(rootSel) || document.body
    const path = (el: Element) => {
      const parts: string[] = []
      let e: Element | null = el
      while (e && e !== document.body && parts.length < 6) {
        const id = e.id ? `#${e.id}` : ''
        const cls = (e.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.')
        parts.unshift(e.tagName.toLowerCase() + id + (cls ? '.' + cls : ''))
        e = e.parentElement
      }
      return parts.join(' > ')
    }
    const scrolls = (el: Element) => { const o = getComputedStyle(el); return /(auto|scroll)/.test(o.overflowX + o.overflowY + o.overflow) }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      out.push({ path: 'html', kind: 'page-x-scroll', by: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: '' })
    }
    const all = rootEl.querySelectorAll<HTMLElement>('*')
    all.forEach((el) => {
      if (!el.offsetParent && el.tagName !== 'BODY') return
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed' || cs.position === 'absolute') return
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      // 1. text/content wider than its own box (nowrap spill) — only when not clipped
      if (!scrolls(el) && cs.overflowX !== 'hidden' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        out.push({ path: path(el), kind: 'spills-self', by: el.scrollWidth - el.clientWidth, text: (el.textContent || '').trim().slice(0, 60) })
      }
      // 2. box outside its parent's box (grid/table cell overlap)
      const p = el.parentElement
      if (p && p !== document.body && !scrolls(p)) {
        const pr = p.getBoundingClientRect()
        const pcs = getComputedStyle(p)
        // recharts' ResponsiveContainer measures itself through a 0×0 shim — a
        // zero-box parent has no width to "spill" out of, so it is not a hit.
        const zeroParent = pr.width === 0 && pr.height === 0
        if (!zeroParent && pcs.overflow !== 'hidden' && pcs.overflowX !== 'hidden' && (r.right > pr.right + 2 || r.left < pr.left - 2)) {
          out.push({ path: path(el), kind: 'spills-parent', by: Math.max(r.right - pr.right, pr.left - r.left), text: (el.textContent || '').trim().slice(0, 60) })
        }
      }
    })
    // de-dupe by path
    const seen = new Set<string>()
    return out.filter((h) => { const k = h.kind + h.path; if (seen.has(k)) return false; seen.add(k); return true })
  }, root)
}

export const AUDIT_WIDTHS = [1024, 1280, 1440, 1920] as const
