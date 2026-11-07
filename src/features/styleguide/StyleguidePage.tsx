import { usePageTitle } from '../../lib/usePageTitle'
import { ComponentSections } from './ComponentSections'
import { TokenSections } from './TokenSections'

const toc = [
  ['color', 'Color'],
  ['contrast', 'Contrast'],
  ['type', 'Type'],
  ['shape', 'Shape'],
  ['motion', 'Motion'],
  ['buttons', 'Buttons'],
  ['chips', 'Chips'],
  ['fit', 'Kid-fit'],
  ['cards', 'Cards'],
  ['loading', 'Loading'],
  ['fields', 'Fields'],
  ['states', 'States'],
] as const

/** Internal review page: tokens and core components, rendered from the real source. */
export function StyleguidePage() {
  usePageTitle('Styleguide')
  return (
    <div className="mx-auto flex w-full max-w-wide flex-col gap-10 px-4 py-8">
      <header>
        <p className="text-small font-semibold tracking-wide text-accent uppercase">Internal</p>
        <h1 className="text-display">Styleguide</h1>
        <p className="mt-2 max-w-prose text-text-muted">
          Tokens and components exactly as the app uses them. Change values in <code>src/styles/tokens.css</code> and
          reload.
        </p>
        <nav aria-label="Styleguide sections" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-(--size-touch) items-center rounded-pill border border-line-strong px-4 text-small font-medium hover:bg-surface-sunken"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <TokenSections />
      <ComponentSections />
    </div>
  )
}
