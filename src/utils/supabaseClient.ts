import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Support both Vite and Next.js environment variable formats
const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                           (typeof import.meta !== 'undefined' ? import.meta.env.VITE_SUPABASE_URL : '') || 
                           (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 
                           'https://hrvawmvpxpnqkxzdwjxl.supabase.co' : '');

const supabaseKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                           (typeof import.meta !== 'undefined' ? import.meta.env.VITE_SUPABASE_ANON_KEY : '') || 
                           (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 
                           'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmF3bXZweHBucWt4emR3anhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwNDE0MDUsImV4cCI6MjA1NTYxNzQwNX0.w3Bkgea9xwiNbgSXWM_sqFWB4K4CmGTcSkihHibgK5s' : '');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables in supabaseClient.ts. Using fallback values if available.');
}

console.log('Supabase URL in supabaseClient:', supabaseUrl);
console.log('Initializing Supabase client in supabaseClient.ts...');

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);