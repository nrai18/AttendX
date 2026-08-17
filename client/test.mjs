import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

const neon = createClient({
  auth: {
    url: "http://localhost:5173",
    adapter: BetterAuthReactAdapter()
  },
  dataApi: {
    url: "http://localhost:5173"
  }
});

console.log(Object.keys(neon.auth));
if (neon.auth.emailOtp) {
  console.log("emailOtp exists:", Object.keys(neon.auth.emailOtp));
} else {
  console.log("emailOtp does not exist");
}
