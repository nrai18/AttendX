import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute stale time
      gcTime: 5 * 60 * 1000, // 5 minutes cache time (formerly cacheTime)
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react';
import { BrowserRouter } from 'react-router-dom';
import { neon } from './lib/neon';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NeonAuthUIProvider emailOTP authClient={neon.auth}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </NeonAuthUIProvider>
    </QueryClientProvider>
  </StrictMode>,
)
