import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { MapView, type MapMarker } from './MapView'

// Leaflet measures its container; give jsdom elements a size so fitBounds has something to work with.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 400 })
})

const markers: MapMarker[] = [
  { id: 'a', position: { lat: 45.52, lng: -122.67 }, level: 'great', label: '88', ariaLabel: 'Marlow & Finch "Bistro", Great fit 88', priority: 88 },
  { id: 'b', position: { lat: 45.53, lng: -122.68 }, level: 'unknown', label: '?', ariaLabel: 'Harbor Noodle Bar, Not enough info', priority: -1 },
]

const props = {
  center: { lat: 45.5231, lng: -122.6765 },
  zoom: 12,
  selectedId: null,
  onSelect: () => undefined,
  label: 'Map of restaurants in Portland',
}

describe('MapView (Leaflet wrapper)', () => {
  it('renders a labelled map region with one real button per pin', () => {
    render(<MapView {...props} markers={markers} />)
    expect(screen.getByRole('region', { name: 'Map of restaurants in Portland' })).toBeInTheDocument()
    // Names with ampersands and quotes survive the HTML-string pin markup.
    expect(screen.getByRole('button', { name: 'Marlow & Finch "Bistro", Great fit 88' })).toHaveTextContent('88')
    expect(screen.getByRole('button', { name: 'Harbor Noodle Bar, Not enough info' })).toHaveTextContent('?')
  })

  it('colours pins by fit level through classes, never inline colour', () => {
    render(<MapView {...props} markers={markers} />)
    expect(screen.getByRole('button', { name: /Marlow/ })).toHaveClass('ts-pin', 'ts-pin--great')
    expect(screen.getByRole('button', { name: /Harbor/ })).toHaveClass('ts-pin--unknown')
  })

  it('reports which pin was clicked', async () => {
    const onSelect = vi.fn()
    render(<MapView {...props} markers={markers} onSelect={onSelect} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Harbor/ }))
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('marks the selected pin, and moves the mark when the selection changes', () => {
    const { rerender } = render(<MapView {...props} markers={markers} selectedId="a" />)
    expect(screen.getByRole('button', { name: /Marlow/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /Marlow/ })).toHaveClass('is-selected')
    expect(screen.getByRole('button', { name: /Harbor/ })).not.toHaveAttribute('aria-current')

    rerender(<MapView {...props} markers={markers} selectedId="b" />)
    expect(screen.getByRole('button', { name: /Harbor/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /Marlow/ })).not.toHaveAttribute('aria-current')
  })

  it('updates pins when the results change', () => {
    const { rerender } = render(<MapView {...props} markers={markers} />)
    rerender(<MapView {...props} markers={markers.slice(0, 1)} />)
    expect(screen.queryByRole('button', { name: /Harbor/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marlow/ })).toBeInTheDocument()
  })

  it('copes with no results and with a user location', () => {
    expect(() =>
      render(<MapView {...props} markers={[]} userLocation={{ lat: 45.5, lng: -122.7 }} />),
    ).not.toThrow()
  })
})
