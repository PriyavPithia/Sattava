import { createClient } from '@supabase/supabase-js';

// Support both Vite and Next.js environment variable formats
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                   process.env.NEXT_PUBLIC_SUPABASE_URL || 
                   window.location.hostname.includes('vercel.app') ? 
                   'https://hrvawmvpxpnqkxzdwjxl.supabase.co' : '';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                        window.location.hostname.includes('vercel.app') ? 
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmF3bXZweHBucWt4emR3anhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwNDE0MDUsImV4cCI6MjA1NTYxNzQwNX0.w3Bkgea9xwiNbgSXWM_sqFWB4K4CmGTcSkihHibgK5s' : '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Using fallback values if available.');
}

console.log('Supabase URL:', supabaseUrl);
console.log('Initializing Supabase client...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 