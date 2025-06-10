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

NetworkHelper.init(import.meta.env.DEV ? 'http://localhost:3000' : `http://${import.meta.env.VITE_BACKEND_HOSTNAME}:${import.meta.env.VITE_BACKEND_PORT}`);


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