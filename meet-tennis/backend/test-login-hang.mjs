import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('ANON_KEY presente:', Boolean(process.env.SUPABASE_ANON_KEY));

console.log('\nCreando cliente público...');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('Llamando signInWithPassword...');
const start = Date.now();

try {
  const { data, error } = await client.auth.signInWithPassword({
    email: 'test@test.com',
    password: 'test123456',
  });
  console.log(`Respuesta en ${Date.now() - start}ms`);
  console.log('error:', error);
  console.log('data:', data);
} catch (err) {
  console.log(`Excepción en ${Date.now() - start}ms:`, err);
}

process.exit(0);