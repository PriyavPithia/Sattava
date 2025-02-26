import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if we have an API key
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      return res.status(500).json({ error: 'OpenAI API key is missing' });
    }

    // Log a masked version of the key
    console.log('OpenAI API key available:', apiKey ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 4)}` : 'MISSING');
    
    // Initialize OpenAI API
    const openai = new OpenAI({
      apiKey: apiKey,
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