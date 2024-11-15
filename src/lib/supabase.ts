import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  throw new Error('Invalid VITE_SUPABASE_URL format. Please provide a valid URL.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

export async function ensureUserBucket(userId: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('csv-uploads')
      .upload(`${userId}/.keep`, new Blob([''], { type: 'text/plain' }), {
        upsert: true
      });

    if (error && error.message !== 'The resource already exists') {
      throw error;
    }
  } catch (error) {
    console.error('Error ensuring user bucket:', error);
    throw error;
  }
}