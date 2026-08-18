import { createClient } from '@neondatabase/neon-js'; const neon = createClient({ auth: { url: 'http://test' } }); console.log(Object.keys(neon.auth));
