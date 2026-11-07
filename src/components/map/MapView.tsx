import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LatLng } from '../../data/types'
import type { FitLevel } from '../../lib/fit'
import { useReducedMotion } from '../../lib/hooks'

/**
 * Thin wrapper around Leaflet + OpenStreetMap tiles (no API key). The rest of
 * the app only knows this props interface, so swapping to another map library
 * means rewriting this one file.
 */

export interface MapMarker {
  id: string
  position: LatLng
  /** Colours the pin. */
  level: FitLevel
  /** Text inside the pin: the score, or "?" when unknown. Never colour alone. */
  label: string
  /** Full accessible name, e.g. "Little Fern Kitchen, Great fit 85". */
  ariaLabel: string
  /** Higher draws on top where pins overlap (best fits win). */
  priority: number
}

export interface MapViewProps {
  center: LatLng
  zoom: number
  markers: readonly MapMarker[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Shown as a blue dot when the user shared their location. */
  userLocation?: LatLng | null
  /** Accessible name for the map region. */
  label: string
  /** Pixels at the bottom covered by an overlay (e.g. a preview card), kept clear when panning to a pin. */
  bottomInset?: number
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const TILE_ERRORS_BEFORE_NOTICE = 3

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const toLatLng = (p: LatLng): L.LatLngExpression => [p.lat, p.lng]

function pinIcon(marker: MapMarker): L.DivIcon {
  // A real <button> inside the marker gives keyboard focus, Enter/Space and a screen-reader name.
  const html =
    `<button type="button" class="ts-pin ts-pin--${marker.level}" aria-label="${escapeHtml(marker.ariaLabel)}">` +
    `<span aria-hidden="true">${escapeHtml(marker.label)}</span></button>`
  return L.divIcon({ html, className: 'ts-pin-wrap', iconSize: [44, 44], iconAnchor: [22, 22] })
}

const SELECTED_Z = 10_000

function applySelection(marker: L.Marker, selected: boolean, priority: number): void {
  const button = marker.getElement()?.querySelector('button')
  if (button) {
    button.classList.toggle('is-selected', selected)
    if (selected) button.setAttribute('aria-current', 'true')
    else button.removeAttribute('aria-current')
  }
  marker.setZIndexOffset(selected ? SELECTED_Z : priority)
}

export function MapView({ center, zoom, markers, selectedId, onSelect, userLocation, label, bottomInset = 0 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markerRefs = useRef(new Map<string, L.Marker>())
  const priorityRefs = useRef(new Map<string, number>())
  const insetRef = useRef(bottomInset)
  const userRef = useRef<L.CircleMarker | null>(null)
  const onSelectRef = useRef(onSelect)
  const selectedRef = useRef(selectedId)
  const [tilesFailed, setTilesFailed] = useState(false)
  const reducedMotion = useReducedMotion()
  const reducedMotionRef = useRef(reducedMotion)

  onSelectRef.current = onSelect
  selectedRef.current = selectedId
  reducedMotionRef.current = reducedMotion
  insetRef.current = bottomInset

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const markerMap = markerRefs.current
    const map = L.map(container, { zoomControl: true, zoomAnimation: !reducedMotionRef.current })
    map.setView(toLatLng(center), zoom)
    const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION })
    let errors = 0
    tiles.on('tileerror', () => {
      errors += 1
      if (errors === TILE_ERRORS_BEFORE_NOTICE) setTilesFailed(true)
    })
    tiles.on('tileload', () => {
      if (errors > 0) {
        errors = 0
        setTilesFailed(false)
      }
    })
    tiles.addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    // Keep tiles correct when the container resizes (rotation, layout changes).
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => map.invalidateSize()) : null
    observer?.observe(container)

    return () => {
      observer?.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      markerMap.clear()
      userRef.current = null
    }
    // The map is created once; position is driven by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild pins when the set of markers changes, and fit them in view.
  const markerKey = markers.map((m) => `${m.id}:${m.level}:${m.label}`).join('|')
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    markerRefs.current.clear()
    priorityRefs.current.clear()
    for (const m of markers) {
      const marker = L.marker(toLatLng(m.position), { icon: pinIcon(m), keyboard: false })
      marker.on('click', () => onSelectRef.current(m.id))
      marker.addTo(layer)
      markerRefs.current.set(m.id, marker)
      priorityRefs.current.set(m.id, m.priority)
      applySelection(marker, m.id === selectedRef.current, m.priority)
    }
    if (markers.length === 0) {
      map.setView(toLatLng(center), zoom, { animate: false })
    } else {
      const bounds = L.latLngBounds(markers.map((m) => toLatLng(m.position)))
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: false })
    }
    // Re-fit only when the markers themselves change, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey])

  // Highlight the selected pin (in place, so keyboard focus isn't lost) and keep it in view.
  useEffect(() => {
    const map = mapRef.current
    for (const [id, marker] of markerRefs.current) applySelection(marker, id === selectedId, priorityRefs.current.get(id) ?? 0)
    const selected = selectedId ? markerRefs.current.get(selectedId) : undefined
    if (map && selected) {
      map.panInside(selected.getLatLng(), {
        paddingTopLeft: [72, 72],
        paddingBottomRight: [72, 72 + insetRef.current],
        animate: !reducedMotionRef.current,
      })
    }
  }, [selectedId, bottomInset])

  // Blue dot for the user's own location.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    userRef.current?.remove()
    userRef.current = null
    if (!userLocation) return
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-focus').trim() || '#2457c5'
    userRef.current = L.circleMarker(toLatLng(userLocation), {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: color,
      fillOpacity: 1,
      interactive: false,
    }).addTo(map)
  }, [userLocation])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} role="region" aria-label={label} className="h-full w-full bg-surface-sunken" />
      {tilesFailed && (
        <p
          role="status"
          className="absolute top-3 left-1/2 z-[1100] flex -translate-x-1/2 items-center gap-2 rounded-pill bg-fit-mixed-bg px-4 py-2 text-small font-medium whitespace-nowrap text-fit-mixed-fg shadow-raised"
        >
          <TriangleAlert size={16} aria-hidden="true" />
          Map tiles can’t load. The list still works.
        </p>
      )}
    </div>
  )
}
