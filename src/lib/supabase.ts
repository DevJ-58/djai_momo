import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requises.');
}

const supabaseFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401 && typeof window !== 'undefined') {
    const requestUrl = input instanceof Request ? input.url : input.toString();
    if (new URL(requestUrl, supabaseUrl).origin === new URL(supabaseUrl).origin) {
      window.dispatchEvent(new Event('supabase-unauthorized'));
    }
  }
  return response;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: supabaseFetch },
});
