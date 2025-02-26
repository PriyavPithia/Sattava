import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow all methods for this debug endpoint
  console.log(`Received ${req.method} request to /api/debug-environment`);
  
  // Create an object to hold our debug info
  const debugInfo = {
    method: req.method,
    // Include a sanitized version of the request headers
    headers: Object.entries(req.headers).reduce((obj, [key, value]) => {
      // Exclude authorization and cookie headers for security
      if (!['authorization', 'cookie'].includes(key.toLowerCase())) {
        obj[key] = value;
      }
      return obj;
    }, {} as Record<string, string | string[] | undefined>),
    // Check environment variables (mask sensitive values)
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      // Check for OpenAI API key (just show if it exists, not the actual value)
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'present (masked)' : 'missing',
      VITE_OPENAI_API_KEY: process.env.VITE_OPENAI_API_KEY ? 'present (masked)' : 'missing',
      // Add other relevant environment variables
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'not set',
    },
    // Add server information
    server: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      // Check if we're running in development or production
      isDev: process.env.NODE_ENV === 'development',
    }
  };
  
  // Return the debug information
  return res.status(200).json(debugInfo);
} 