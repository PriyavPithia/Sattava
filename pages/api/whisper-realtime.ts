import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
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
    const form = new formidable.IncomingForm();
    form.keepExtensions = true;
    
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Get the audio chunk
    const file = files.audio as formidable.File;
    if (!file) {
      return res.status(400).json({ error: 'No audio chunk provided' });
    }

    // Initialize OpenAI API
    const openai = new OpenAI({
      apiKey: process.env.VITE_OPENAI_API_KEY,
    });

    // Send the audio chunk to OpenAI Whisper API
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(file.filepath) as any,
      model: 'whisper-1',
      response_format: 'json',
      temperature: 0.3,
      language: 'en'
    });

    // Return the transcription
    return res.status(200).json({ 
      transcription: response.text,
      type: 'speech'
    });
  } catch (error) {
    console.error('Error processing audio chunk:', error);
    return res.status(500).json({ error: 'Error processing audio chunk' });
  }
} 