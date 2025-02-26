import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    console.error(`Method ${req.method} not allowed - only GET is supported`);
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: `Method ${req.method} not allowed - use GET instead` });
  }

  console.log(`Processing ${req.method} request to /api/test-openai`);

  try {
    // Check if we have an API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Try alternative environment variable name
      const altApiKey = process.env.VITE_OPENAI_API_KEY;
      if (!altApiKey) {
        console.error('OpenAI API key is missing from both OPENAI_API_KEY and VITE_OPENAI_API_KEY');
        return res.status(500).json({ error: 'OpenAI API key is missing from server configuration' });
      }
      console.log('Using alternative API key from VITE_OPENAI_API_KEY');
    }

    // Use whichever key is available
    const finalApiKey = apiKey || process.env.VITE_OPENAI_API_KEY;

    // Log a masked version of the key
    console.log('OpenAI API key available:', finalApiKey ? `${finalApiKey.substring(0, 3)}...${finalApiKey.substring(finalApiKey.length - 4)}` : 'MISSING');
    
    // Initialize OpenAI API
    const openai = new OpenAI({
      apiKey: finalApiKey,
    });

    try {
      // Make a simple test API call
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say hello world" }
        ],
        max_tokens: 10
      });

      // Return successful response
      return res.status(200).json({ 
        success: true,
        message: 'OpenAI API connection successful',
        response: response.choices[0].message
      });
    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError.message, openaiError.status);
      return res.status(openaiError.status || 500).json({ 
        error: `OpenAI API error: ${openaiError.message}` 
      });
    }
  } catch (error: any) {
    console.error('Error testing OpenAI API:', error.message);
    return res.status(500).json({ 
      error: `Server error: ${error.message}` 
    });
  }
} 