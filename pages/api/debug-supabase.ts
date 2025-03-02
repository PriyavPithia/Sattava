import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type DebugInfo = {
  timestamp: string;
  environment: {
    supabaseUrl: string;
    hasSupabaseKey: boolean;
    nodeEnv: string | undefined;
  };
  supabaseClient: string | null;
  auth: {
    hasSession?: boolean;
    user?: {
      id: string;
      email: string | undefined;
      isAuthenticated: boolean;
    } | null;
    error?: string;
    status?: number;
  } | null;
  projects: {
    count?: number;
    data?: any[];
    error?: string;
    code?: string;
  } | null;
  error: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log(`Processing ${req.method} request to /api/debug-supabase`);
  
  try {
    // Get Supabase credentials from environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    // Create debug info object
    const debugInfo: DebugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 10)}...` : 'not set',
        hasSupabaseKey: !!supabaseKey,
        nodeEnv: process.env.NODE_ENV,
      },
      supabaseClient: null,
      auth: null,
      projects: null,
      error: null
    };
    
    // Check if we have the required credentials
    if (!supabaseUrl || !supabaseKey) {
      debugInfo.error = 'Missing Supabase credentials';
      return res.status(500).json(debugInfo);
    }
    
    // Initialize Supabase client
    console.log('Initializing Supabase client with URL:', supabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseKey);
    debugInfo.supabaseClient = 'initialized';
    
    // Try to get the current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      debugInfo.auth = {
        error: sessionError.message,
        status: sessionError.status
      };
    } else {
      debugInfo.auth = {
        hasSession: !!sessionData.session,
        user: sessionData.session ? {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email,
          isAuthenticated: !!sessionData.session.user.id
        } : null
      };
    }
    
    // Try to access the projects table
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, created_at')
      .limit(5);
      
    if (projectsError) {
      debugInfo.projects = {
        error: projectsError.message,
        code: projectsError.code
      };
    } else {
      debugInfo.projects = {
        count: projects?.length || 0,
        data: projects || []
      };
    }
    
    // Return the debug information
    return res.status(200).json(debugInfo);
    
  } catch (error: any) {
    console.error('Error in debug-supabase endpoint:', error);
    return res.status(500).json({ 
      error: `Server error: ${error.message}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 