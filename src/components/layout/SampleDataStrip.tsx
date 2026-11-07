import { FlaskConical } from 'lucide-react'

/** Thin, always-visible notice so test participants know nothing here is real. */
export function SampleDataStrip() {
  return (
    <p className="flex items-center justify-center gap-1.5 bg-surface-sunken px-4 py-1 text-caption text-text-muted">
      <FlaskConical size={12} aria-hidden="true" />
      <span>
        <strong className="font-semibold">Sample data</strong> · restaurants in this prototype are fictional
      </span>
    </p>
  )
}
