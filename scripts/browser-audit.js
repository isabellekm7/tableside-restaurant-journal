/**
 * In-browser QA audit for Tableside (dev server only).
 *
 * Checks, on the REAL rendered page (so colour contrast and sizes are measured, not guessed):
 *   - axe-core accessibility rules, including colour contrast
 *   - touch targets smaller than 44 x 44 px (WCAG 2.5.8 / the brief's minimum)
 *   - horizontal overflow (anything wider than the viewport)
 *   - browser console errors are NOT collected here; check the console separately
 *
 * How to run (with `npm run dev` going), in the browser console on any page of the app:
 *
 *     const { auditRoutes } = await import('/scripts/browser-audit.js')
 *     console.table(await auditRoutes(['/', '/right-now', '/saved']))
 *
 * Use your browser's device toolbar to try phone / tablet / desktop widths.
 */

const INTERACTIVE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"]'
const MIN_TARGET = 44

function loadAxe() {
  if (window.axe) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/node_modules/axe-core/axe.min.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load axe-core. Run this against the dev server (npm run dev).'))
    document.head.append(script)
  })
}

const isVisible = (el) => {
  const rect = el.getBoundingClientRect()
  const style = getComputedStyle(el)
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
}

/** Elements whose tappable area is smaller than 44 x 44 CSS px. Inline links inside sentences are exempt. */
function smallTargets() {
  const offenders = []
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (!isVisible(el)) continue
    const rect = el.getBoundingClientRect()
    // Visually hidden inputs (custom radios/checkboxes): their <label> is the real target.
    if (rect.width <= 2 && rect.height <= 2) continue
    if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue
    // Visually hidden until focused (e.g. the skip link): clipped to nothing, so not a tap target.
    const style = getComputedStyle(el)
    if (style.clip === 'rect(0px, 0px, 0px, 0px)' || style.clipPath === 'inset(50%)') continue
    if (el.closest('.leaflet-control-attribution')) continue
    if (rect.width < MIN_TARGET - 0.5 || rect.height < MIN_TARGET - 0.5) {
      offenders.push({
        element: `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''}`,
        text: (el.textContent || '').trim().slice(0, 30),
        size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
      })
    }
  }
  return offenders
}

export async function auditPage() {
  await loadAxe()
  const results = await window.axe.run(document, { resultTypes: ['violations'] })
  return {
    axe: results.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(' ')} → ${v.nodes[0]?.html.slice(0, 90)}`),
    smallTargets: smallTargets(),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    width: window.innerWidth,
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Audit several routes using in-app navigation (no reloads), returning one summary row per route. */
export async function auditRoutes(paths, { settleMs = 2500 } = {}) {
  const rows = []
  for (const path of paths) {
    history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await wait(settleMs)
    const result = await auditPage()
    rows.push({ path, ...result })
  }
  return rows
}

window.tablesideAudit = { auditRoutes, auditPage }
