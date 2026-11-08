import type { RouteObject } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { RouteFallback } from '../components/layout/RouteFallback'
import { AccountPage } from '../features/account/AccountPage'
import { RestaurantDetailPage } from '../features/detail/RestaurantDetailPage'
import { DiscoveryPage } from '../features/discovery/DiscoveryPage'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { RightNowPage } from '../features/rightNow/RightNowPage'
import { SavedPage } from '../features/saved/SavedPage'
import { SharedListPage } from '../features/saved/SharedListPage'
import { NotFoundPage } from '../routes/NotFoundPage'

/**
 * Route table, shared by the app (createBrowserRouter) and tests (createMemoryRouter).
 * /styleguide and /debug are internal: they are not linked from the navigation.
 */
export const routes: RouteObject[] = [
  { path: 'welcome', element: <OnboardingPage /> },
  {
    element: <AppShell />,
    HydrateFallback: RouteFallback,
    children: [
      { index: true, element: <DiscoveryPage /> },
      { path: 'restaurant/:id', element: <RestaurantDetailPage /> },
      { path: 'right-now', element: <RightNowPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'saved', element: <SavedPage /> },
      { path: 'shared', element: <SharedListPage /> },
      { path: 'styleguide', lazy: async () => ({ Component: (await import('../features/styleguide/StyleguidePage')).StyleguidePage }) },
      { path: 'debug', lazy: async () => ({ Component: (await import('../features/debug/DebugPage')).DebugPage }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
