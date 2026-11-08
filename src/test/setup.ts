import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { EVENTS_STORAGE_KEY } from '../lib/analytics/logger'
import { auth } from '../data'
import { useAuthStore } from '../store/authStore'
import { useTripStore } from '../store/tripStore'
import { initialDiscoveryData, useDiscoveryStore } from '../store/discoveryStore'
import { useProfileStore } from '../store/profileStore'
import { useUiStore } from '../store/uiStore'

// jsdom doesn't implement the modal <dialog> API. Minimal stand-in so Sheet works in tests.
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

document.documentElement.lang = 'en' // mirrors index.html

beforeEach(() => {
  // jsdom doesn't implement scrolling; ScrollRestoration calls it on every navigation.
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  // Isolated state for every test; keep the app's console logging out of test output.
  localStorage.clear()
  localStorage.removeItem(EVENTS_STORAGE_KEY)
  useProfileStore.getState().reset()
  useUiStore.setState({ profileSheetOpen: false })
  useDiscoveryStore.setState(initialDiscoveryData)
  useAuthStore.setState({ service: auth, user: null, ready: false, recovering: false })
  useTripStore.setState({ lists: [], loaded: false, activeListId: null, error: null })
  vi.spyOn(console, 'debug').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
