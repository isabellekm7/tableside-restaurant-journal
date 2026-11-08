import axe from 'axe-core'

/**
 * Run axe-core on the current document. jsdom has no layout or canvas, so colour
 * contrast can't be measured here; it is covered by the token contrast tests and by a
 * real-browser audit instead.
 */
export async function auditAccessibility(context: Element | Document = document): Promise<string[]> {
  const results = await axe.run(context, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  })
  return results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 3).map((n) => `    ${n.target.join(' ')}  →  ${n.html.slice(0, 120)}`).join('\n')}`,
  )
}
