import type { RouteObject } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { AccountPage } from '../features/account/AccountPage'
import { DebugPage } from '../features/debug/DebugPage'
import { RestaurantDetailPage } from '../features/detail/RestaurantDetailPage'
import { DiscoveryPage } from '../features/discovery/DiscoveryPage'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { RightNowPage } from '../features/rightNow/RightNowPage'
import { StyleguidePage } from '../features/styleguide/StyleguidePage'
import { NotFoundPage } from '../routes/NotFoundPage'
import { PlaceholderPage } from '../routes/PlaceholderPage'

/**
 * Route table, shared by the app (createBrowserRouter) and tests (createMemoryRouter).
 * /styleguide and /debug are internal: they are not linked from the navigation.
 */
export const routes: RouteObject[] = [
  { path: 'welcome', element: <OnboardingPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DiscoveryPage /> },
      { path: 'restaurant/:id', element: <RestaurantDetailPage /> },
      { path: 'right-now', element: <RightNowPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'saved', element: <PlaceholderPage title="Saved" phase={6} /> },
      { path: 'styleguide', element: <StyleguidePage /> },
      { path: 'debug', element: <DebugPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
