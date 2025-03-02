import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../src/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow all methods for this debug endpoint
  console.log(`Received ${req.method} request to /api/debug-auth`);
  
  // Create an object to hold our debug info
  const debugInfo = {
    method: req.method,
    timestamp: new Date().toISOString(),
    // Check environment variables (mask sensitive values)
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present (masked)' : 'missing',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'present (masked)' : 'missing',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'present (masked)' : 'missing',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'present (masked)' : 'missing',
    }
  };
  
  // Try to get the current session
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      debugInfo['auth_error'] = {
        message: error.message,
        status: error.status
      };
    } else {
      debugInfo['auth_session'] = {
        exists: !!data.session,
        user: data.session ? {
          id: data.session.user.id,
          email: data.session.user.email,
          isAuthenticated: !!data.session.user.id
        } : null
      };
    }
    
    // Try to get projects
    try {
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .limit(5);
        
      if (projectsError) {
        debugInfo['projects_error'] = {
          message: projectsError.message,
          code: projectsError.code
        };
      } else {
        debugInfo['projects'] = {
          count: projects?.length || 0,
          sample: projects?.slice(0, 2).map(p => ({ id: p.id, name: p.name })) || []
        };
      }
    } catch (projectsError) {
      debugInfo['projects_error'] = {
        message: projectsError.message || 'Unknown error fetching projects'
      };
    }
    
  } catch (authError) {
    debugInfo['auth_error'] = {
      message: authError.message || 'Unknown error checking authentication'
    };
  }
  
  // Return the debug information
  return res.status(200).json(debugInfo);
} 