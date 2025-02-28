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
  },
};

// Configure ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the form data
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Get the video file
    const fileArray = files.video;
    if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const file = fileArray[0];
    if (!file.mimetype?.startsWith('video/')) {
      return res.status(400).json({ error: 'File must be a video' });
    }

    // Create temporary directories if they don't exist
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const inputPath = file.filepath;
    const outputPath = path.join(tmpDir, `${Date.now()}-output.mp3`);

    // Convert video to audio
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => {
          resolve();
        })
        .save(outputPath);
    });

    // Read the converted file
    const audioData = await fs.promises.readFile(outputPath);

    // Set response headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioData.length);

    // Send the audio file
    res.send(audioData);

    // Clean up files
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});

  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({ 
      error: 'Error converting video to audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 