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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the form data
    const form = formidable({
      keepExtensions: true
    });
    
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Get the audio file
    const fileArray = files.audio;
    if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    const file = fileArray[0]; // Get the first file from the array

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

    // Check if we have an API key
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      return res.status(500).json({ error: 'OpenAI API key is missing' });
    }

    // Initialize OpenAI API
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    try {
      // Send the audio to OpenAI Whisper API
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath) as any,
        model: 'whisper-1',
        response_format: 'json',
        temperature: 0.3,
        language: 'en'
      });

      console.log('Whisper API response received successfully');
      
      // Return the transcription
      return res.status(200).json({ 
        transcription: response.text,
        type: 'speech'
      });
    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError.message, openaiError.status);
      return res.status(openaiError.status || 500).json({ 
        error: `OpenAI API error: ${openaiError.message}` 
      });
    }
  } catch (error: any) {
    console.error('Error processing audio:', error.message);
    return res.status(500).json({ 
      error: `Server error processing audio: ${error.message}` 
    });
  }
} 