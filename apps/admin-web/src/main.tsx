import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
      queries: {
          retry: 1,
          refetchOnWindowFocus: false,
      },
  },
});


const protocol = import.meta.env.VITE_USE_HTTPS === '1' && (!import.meta.env.DEV || import.meta.env.VITE_USE_HTTPS_IN_DEV === '1') ? 'https' : 'http';
const backendUrl = import.meta.env.DEV ? `${protocol}://localhost:3000` : `${protocol}://${import.meta.env.VITE_BACKEND_HOSTNAME}:${import.meta.env.VITE_BACKEND_PORT}`;

NetworkHelper.init(backendUrl, () => Intl.DateTimeFormat().resolvedOptions().timeZone);


const router = createRouter({ 
  routeTree,
  basepath: import.meta.env.PROD ? '/admin' : undefined
})

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);