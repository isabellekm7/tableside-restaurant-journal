import type { RouteObject } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { StyleguidePage } from '../features/styleguide/StyleguidePage'
import { HomePage } from '../routes/HomePage'
import { NotFoundPage } from '../routes/NotFoundPage'
import { PlaceholderPage } from '../routes/PlaceholderPage'

/**
 * Route table, shared by the app (createBrowserRouter) and tests (createMemoryRouter).
 * /styleguide and /debug are internal: they are not linked from the navigation.
 */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'restaurant/:id', element: <PlaceholderPage title="Restaurant" phase={5} /> },
      { path: 'saved', element: <PlaceholderPage title="Saved" phase={6} /> },
      { path: 'styleguide', element: <StyleguidePage /> },
      { path: 'debug', element: <PlaceholderPage title="Debug" phase={3} /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
