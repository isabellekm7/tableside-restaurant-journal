import { Check, Copy, Pencil, Plus, Printer, Share2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ChoiceChips } from '../../components/ui/ChoiceChips'
import { Skeleton } from '../../components/ui/Skeleton'
import { StateMessage } from '../../components/ui/StateMessage'
import { TextField } from '../../components/ui/TextField'
import type { TripList } from '../../data'
import { buildShareUrl } from '../../lib/share/shareLink'
import { MAX_LIST_NAME } from '../../lib/trips/lists'
import { usePageTitle } from '../../lib/usePageTitle'
import { useTripStore } from '../../store/tripStore'
import { ListItems } from './ListItems'

function NewListForm({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onCreate(name)
    setName('')
  }
  return (
    <form onSubmit={submit} className="flex items-end gap-2" aria-label="Create a list">
      <TextField className="flex-1" label="New list" placeholder="e.g. Weekend in Chicago" maxLength={MAX_LIST_NAME} value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" variant="secondary" leadingIcon={<Plus size={18} aria-hidden="true" />} disabled={name.trim() === ''}>
        Create
      </Button>
    </form>
  )
}

function SharePanel({ list }: { list: TripList }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const url = buildShareUrl(window.location.origin, { name: list.name, restaurantIds: [...list.restaurantIds] })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      setState('manual') // clipboard blocked: show the link so it can be copied by hand
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-sunken p-3 print:hidden">
      <Button variant="secondary" onClick={copy} leadingIcon={state === 'copied' ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}>
        {state === 'copied' ? 'Link copied' : 'Copy share link'}
      </Button>
      {state !== 'idle' && (
        <input readOnly aria-label="Share link" value={url} onFocus={(e) => e.currentTarget.select()} className="min-h-(--size-touch) w-full rounded-md border border-line-strong bg-surface px-3 text-small" />
      )}
      <p className="text-small text-text-muted">Anyone with this link sees the list’s name and its places. Nothing else about you is included.</p>
    </div>
  )
}

function ListPanel({ list, isActive }: { list: TripList; isActive: boolean }) {
  const { renameList, deleteList, removeFromList, setActive } = useTripStore()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(list.name)
  const [sharing, setSharing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <section aria-labelledby="list-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {renaming ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void renameList(list.id, draft)
                setRenaming(false)
              }}
              className="flex items-end gap-2"
            >
              <TextField label="List name" maxLength={MAX_LIST_NAME} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button type="submit">Save</Button>
              <Button variant="ghost" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <h2 id="list-title" className="text-heading">
                {list.name}
              </h2>
              <p className="text-small text-text-muted">
                {list.restaurantIds.length} {list.restaurantIds.length === 1 ? 'place' : 'places'}
                {isActive && ' · new saves go here'}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {!isActive && <Button variant="secondary" onClick={() => setActive(list.id)}>Save new places here</Button>}
        <Button variant="secondary" leadingIcon={<Share2 size={18} aria-hidden="true" />} onClick={() => setSharing((s) => !s)} aria-expanded={sharing}>
          Share
        </Button>
        <Button variant="secondary" leadingIcon={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="ghost" leadingIcon={<Pencil size={18} aria-hidden="true" />} onClick={() => { setDraft(list.name); setRenaming(true) }}>
          Rename
        </Button>
        {confirmDelete ? (
          <>
            <Button variant="accent" leadingIcon={<Trash2 size={18} aria-hidden="true" />} onClick={() => { void deleteList(list.id); setConfirmDelete(false) }}>
              Yes, delete “{list.name}”
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button variant="ghost" leadingIcon={<Trash2 size={18} aria-hidden="true" />} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>

      {sharing && <SharePanel list={list} />}

      <ListItems ids={list.restaurantIds} onRemove={(id) => void removeFromList(list.id, id)} emptyText="Nothing here yet. Tap the bookmark on any restaurant to save it to this list." />

      <p className="hidden text-small text-text-muted print:block">Sample data: the restaurants in this list are fictional. Printed from Tableside.</p>
    </section>
  )
}

/** /saved: your trip lists. They live on this device first, so they work offline. */
export function SavedPage() {
  usePageTitle('Saved')
  const { lists, loaded, activeListId, error, createList } = useTripStore()
  const [viewingId, setViewingId] = useState<string | null>(null)
  const viewing = lists.find((l) => l.id === (viewingId ?? activeListId)) ?? lists[0]

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-6">
      <div className="print:hidden">
        <h1 className="text-display">Saved</h1>
        <p className="mt-1 text-text-muted">Your shortlist for the trip. Saved on this device, so it works without a signal.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-small font-medium text-danger">
          {error}
        </p>
      )}

      {!loaded && (
        <div role="status" aria-label="Loading your lists" className="flex flex-col gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-32" />
        </div>
      )}

      {loaded && lists.length === 0 && (
        <StateMessage kind="empty" title="Nothing saved yet" action={<ButtonLink to="/">Find a restaurant</ButtonLink>}>
          Tap the bookmark on any restaurant to start a shortlist for your trip.
        </StateMessage>
      )}

      {loaded && viewing && (
        <>
          {lists.length > 1 && (
            <div className="print:hidden">
              <ChoiceChips legend="Your lists" value={viewing.id} onChange={setViewingId} options={lists.map((l) => ({ value: l.id, label: `${l.name} (${l.restaurantIds.length})` }))} />
            </div>
          )}
          <ListPanel key={viewing.id} list={viewing} isActive={viewing.id === activeListId} />
        </>
      )}

      {loaded && (
        <div className="print:hidden">
          <NewListForm onCreate={(name) => void createList(name).then((l) => setViewingId(l.id))} />
        </div>
      )}
    </div>
  )
}
