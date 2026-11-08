import { Check, CircleAlert, Copy, Database, Download, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { backend, clearFallbackIncidents, getFallbackIncidents, type ConnectionCheck } from '../../data'
import { logger } from '../../lib/analytics/logger'
import { DECISION_GOAL_MS, formatDuration, goalRate, summarizeSessions } from '../../lib/analytics/metrics'
import { usePageTitle } from '../../lib/usePageTitle'
import { useProfileStore } from '../../store/profileStore'

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const timestampForFilename = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

/** Hidden researcher view: usability-test events and the 60-second metric. Not linked from the UI. */
export function DebugPage() {
  usePageTitle('Debug')
  const [events, setEvents] = useState(() => logger.getEvents())
  const [copied, setCopied] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const resetProfile = useProfileStore((s) => s.reset)
  const [connection, setConnection] = useState<ConnectionCheck | 'checking' | null>(null)
  const [incidents, setIncidents] = useState(() => getFallbackIncidents())

  const runConnectionCheck = async () => {
    if (!backend.check) return
    setConnection('checking')
    setConnection(await backend.check())
    setIncidents(getFallbackIncidents())
  }

  const refresh = () => setEvents(logger.getEvents())
  const sessions = summarizeSessions(events)
  const rate = goalRate(sessions)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(logger.exportJson())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; Export still works.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-wide flex-col gap-8 px-4 py-8">
      <header>
        <p className="text-small font-semibold tracking-wide text-accent uppercase">Internal · researcher view</p>
        <h1 className="text-display">Debug</h1>
        <p className="mt-2 max-w-prose text-text-muted">
          Events are recorded on this device only (console + localStorage) and contain no names or free text. A
          “session” is one page load.
        </p>
      </header>

      <section aria-labelledby="backend-title" className="flex flex-col gap-3">
        <h2 id="backend-title" className="text-title">
          Backend connection
        </h2>
        <Card className="flex flex-col gap-3">
          <p className="flex items-center gap-2">
            <Database size={20} aria-hidden="true" className="text-primary" />
            {backend.source === 'supabase' ? (
              <span>
                Configured to use <strong>Supabase</strong> at <code>{backend.host}</code>.
              </span>
            ) : (
              <span>
                <strong>Not configured.</strong> Using the bundled sample data on this device. Add
                <code> VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code> and restart.
              </span>
            )}
          </p>
          {backend.check && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={runConnectionCheck} disabled={connection === 'checking'}>
                {connection === 'checking' ? 'Checking…' : 'Run connection check'}
              </Button>
              <span className="text-small text-text-muted">Read-only: counts rows, creates no account, writes nothing.</span>
            </div>
          )}
          {connection && connection !== 'checking' && (
            <p role="status" className={connection.ok ? 'flex items-center gap-2 font-semibold text-fit-great-fg' : 'flex items-center gap-2 font-semibold text-danger'}>
              {connection.ok ? <Check size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
              {connection.ok
                ? `Connected: ${connection.restaurants} restaurants and ${connection.cities} cities in the database (${connection.ms} ms).`
                : `Not connected: ${connection.error ?? 'unknown error'}`}
            </p>
          )}
          <div>
            <p className="text-small font-semibold">Times this session the app fell back to on-device data</p>
            {incidents.length === 0 ? (
              <p className="text-small text-text-muted">None. Everything you've seen came from {backend.source === 'supabase' ? 'the backend' : 'the bundled data'}.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1 text-small">
                {incidents.map((i) => (
                  <li key={i.at + i.operation} className="text-danger">
                    {new Date(i.at).toLocaleTimeString()} · {i.operation}: {i.message}
                  </li>
                ))}
              </ul>
            )}
            {incidents.length > 0 && (
              <Button variant="ghost" onClick={() => { clearFallbackIncidents(); setIncidents([]) }}>
                Clear list
              </Button>
            )}
          </div>
        </Card>
      </section>

      <section aria-labelledby="metric-title" className="flex flex-col gap-3">
        <h2 id="metric-title" className="text-title">
          60-second metric
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-small text-text-muted">Sessions recorded</p>
            <p className="text-heading tabular-nums">{sessions.length}</p>
          </Card>
          <Card>
            <p className="text-small text-text-muted">Decided within {DECISION_GOAL_MS / 1000}s</p>
            <p className="text-heading tabular-nums">{rate === null ? '–' : `${Math.round(rate * 100)}%`}</p>
          </Card>
          <Card>
            <p className="text-small text-text-muted">Events stored</p>
            <p className="text-heading tabular-nums">{events.length}</p>
          </Card>
        </div>

        {sessions.length === 0 ? (
          <p className="text-text-muted">No sessions yet. Use the app, then press Refresh.</p>
        ) : (
          <div role="region" aria-label="Per-session results table" tabIndex={0} className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-left text-small">
              <caption className="sr-only">Per-session results</caption>
              <thead className="bg-surface-sunken text-text-muted">
                <tr>
                  {['Session', 'Opened', 'Time to decision', 'Excl. onboarding', 'Met 60s', 'Bail-outs', 'Right now', 'Filters'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.sessionId} className="border-t border-line">
                    <th scope="row" className="px-3 py-2 font-mono text-caption font-normal">{s.sessionId}</th>
                    <td className="px-3 py-2">{new Date(s.openedAt).toLocaleString()}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDuration(s.msToDecision)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDuration(s.msToDecisionExcludingOnboarding)}</td>
                    <td className="px-3 py-2">{s.metGoal === null ? 'No decision' : s.metGoal ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 tabular-nums">{s.bailOuts}</td>
                    <td className="px-3 py-2">{s.rightNowUsed ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 tabular-nums">{s.filtersUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="actions-title" className="flex flex-col gap-3">
        <h2 id="actions-title" className="text-title">
          Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" leadingIcon={<RefreshCw size={18} aria-hidden="true" />} onClick={refresh}>
            Refresh
          </Button>
          <Button
            leadingIcon={<Download size={18} aria-hidden="true" />}
            onClick={() => downloadText(`tableside-events-${timestampForFilename()}.json`, logger.exportJson())}
          >
            Export JSON
          </Button>
          <Button
            variant="secondary"
            leadingIcon={copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            onClick={copy}
          >
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
          <Button
            variant="ghost"
            leadingIcon={<Trash2 size={18} aria-hidden="true" />}
            onClick={() => {
              if (!confirmClear) return setConfirmClear(true)
              logger.clear()
              setConfirmClear(false)
              refresh()
            }}
          >
            {confirmClear ? 'Really clear all events?' : 'Clear events'}
          </Button>
        </div>
        <div>
          <p className="mb-2 text-small text-text-muted">
            Between test participants, reset the app so the next person sees first-run onboarding. This does not delete events.
          </p>
          <Button variant="secondary" onClick={() => resetProfile()}>
            Reset kids and onboarding
          </Button>
        </div>
      </section>

      <section aria-labelledby="log-title" className="flex flex-col gap-3">
        <h2 id="log-title" className="text-title">
          Event log
        </h2>
        {events.length === 0 ? (
          <p className="text-text-muted">Nothing recorded yet.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {[...events].reverse().slice(0, 200).map((e) => {
              const { id, ts, sessionId, msSinceOpen, type, ...details } = e
              return (
                <li key={id} className="flex flex-col gap-1 px-3 py-2 text-small sm:flex-row sm:gap-4">
                  <span className="w-28 shrink-0 tabular-nums text-text-muted">+{formatDuration(msSinceOpen)}</span>
                  <span className="w-48 shrink-0 font-semibold">{type}</span>
                  <code className="min-w-0 break-words text-caption text-text-muted" title={`${new Date(ts).toISOString()} · ${sessionId}`}>
                    {Object.keys(details).length ? JSON.stringify(details) : ''}
                  </code>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
