import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Configure to handle form data
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '25mb',
  },
};

// Configure ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
  console.log('FFmpeg path set to:', ffmpegStatic);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log('Received request to /api/convert');
  console.log('Request method:', req.method);
  console.log('Request headers:', req.headers);
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create temp directory in /tmp for Vercel
    const tmpDir = '/tmp';
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    console.log('Using temp directory:', tmpDir);

    // Parse the form data
    const form = formidable({
      uploadDir: tmpDir,
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
    });

    console.log('Parsing form data...');
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Error parsing form:', err);
          reject(err);
        }
        resolve([fields, files]);
      });
    });

    // Get the video file
    const fileArray = files.video;
    if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
      console.error('No video file in request');
      return res.status(400).json({ error: 'No video file provided' });
    }

    const file = fileArray[0];
    console.log('Received file:', file.originalFilename);

    if (!file.mimetype?.startsWith('video/')) {
      console.error('Invalid file type:', file.mimetype);
      return res.status(400).json({ error: 'File must be a video' });
    }

    const inputPath = file.filepath;
    const outputPath = path.join(tmpDir, `${Date.now()}-output.mp3`);
    
    console.log('Converting video to audio...');
    console.log('Input path:', inputPath);
    console.log('Output path:', outputPath);

    // Convert video to audio
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .on('start', (commandLine) => {
          console.log('FFmpeg started with command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing:', progress.percent, '% done');
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('FFmpeg processing finished');
          resolve();
        })
        .save(outputPath);
    });

    // Read the converted file
    console.log('Reading converted audio file...');
    const audioData = await fs.promises.readFile(outputPath);

    // Set response headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioData.length);
    res.setHeader('Content-Disposition', `attachment; filename=converted-${Date.now()}.mp3`);

    // Send the audio file
    console.log('Sending audio data...');
    res.status(200).send(audioData);

    // Clean up files
    console.log('Cleaning up temporary files...');
    try {
      await fs.promises.unlink(inputPath);
      await fs.promises.unlink(outputPath);
      console.log('Temporary files cleaned up');
    } catch (cleanupError) {
      console.error('Error cleaning up files:', cleanupError);
    }

  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({ 
      error: 'Error converting video to audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 