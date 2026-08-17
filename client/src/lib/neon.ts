import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

export const neon = createClient({
  auth: {
    url: import.meta.env.VITE_NEON_AUTH_URL,
    adapter: BetterAuthReactAdapter(),
  },
  dataApi: {
    url: "https://ep-dummy.c-3.ap-southeast-1.aws.neon.tech/rest/v1" // Dummy URL to satisfy SDK types, we use custom backend
  }
});
