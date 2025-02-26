import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

// Disable the default body parser to handle form data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    console.error(`Method ${req.method} not allowed - only POST is supported`);
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: `Method ${req.method} not allowed - use POST instead` });
  }

  console.log(`Processing ${req.method} request to /api/whisper-transcription`);
  
  try {
    console.log('Starting whisper transcription request');
    
    // Parse the form data
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB max size
    });
    
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Form parsing error:', err);
          reject(err);
        }
        resolve([fields, files]);
      });
    });

    console.log('Form parsed successfully');

    // Get the audio file
    const fileArray = files.audio;
    if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
      console.error('No audio file found in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    const file = fileArray[0]; // Get the first file from the array
    console.log(`File received: ${file.originalFilename}, mimetype: ${file.mimetype}`);

    // Validate mime type
    if (!file.mimetype || !file.mimetype.startsWith('audio/')) {
      console.error(`Invalid file type: ${file.mimetype}`);
      return res.status(400).json({ error: 'File must be an audio file' });
    }

    // Read the file
    const filePath = file.filepath;
    if (!fs.existsSync(filePath)) {
      console.error('File does not exist at path:', filePath);
      return res.status(400).json({ error: 'File not found on server' });
    }
    
    // Validate file size
    const stats = fs.statSync(filePath);
    console.log(`Processing audio file: ${file.originalFilename}, size: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      return res.status(400).json({ error: 'Audio file is empty' });
    }
    
    if (stats.size > 25 * 1024 * 1024) { // 25MB limit
      return res.status(400).json({ error: 'Audio file exceeds 25MB limit' });
    }

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
    
    // Log a masked version of the key to help with debugging
    console.log('OpenAI API key available:', finalApiKey ? `${finalApiKey.substring(0, 3)}...${finalApiKey.substring(finalApiKey.length - 4)}` : 'MISSING');
    
    console.log('Initializing OpenAI API');
    // Initialize OpenAI API
    const openai = new OpenAI({
      apiKey: finalApiKey,
    });

    try {
      console.log('Sending file to Whisper API...');
      // Create a readable stream from the file
      const fileStream = fs.createReadStream(filePath);
      
      // Send the audio to OpenAI Whisper API
      const response = await openai.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        response_format: 'json',
        temperature: 0.3,
        language: 'en'
      });

      console.log('Whisper API response received:', response);
      
      if (!response || !response.text) {
        console.error('Empty response from Whisper API');
        return res.status(500).json({ error: 'Empty response from transcription service' });
      }
      
      // Return the transcription
      const result = { 
        transcription: response.text,
        type: 'speech'
      };
      
      console.log('Sending successful response');
      return res.status(200).json(result);
    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError.message, openaiError.status, openaiError.stack);
      return res.status(openaiError.status || 500).json({ 
        error: `OpenAI API error: ${openaiError.message}` 
      });
    }
  } catch (error: any) {
    console.error('Error processing audio:', error.message, error.stack);
    // Send a properly formatted JSON response even in case of errors
    return res.status(500).json({ 
      error: `Server error processing audio: ${error.message}` 
    });
  }
} 