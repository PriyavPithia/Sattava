import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import formidable from 'formidable';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { promisify } from 'util';

// Set FFmpeg path if available
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

const UPLOAD_DIR = './tmp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Ensure temporary directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const options: formidable.Options = {
    uploadDir: UPLOAD_DIR,
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024, // 100MB
  };

  try {
    const form = formidable(options);
    const [fields, files] = await new Promise<[formidable.Fields<string>, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });
    
    const videoFiles = files.video as formidable.File[];
    if (!videoFiles || videoFiles.length === 0) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }
    
    const videoFile = videoFiles[0];
    const inputPath = videoFile.filepath;
    const outputFilename = `${Date.now()}.mp3`;
    const outputPath = path.join(UPLOAD_DIR, outputFilename);

    // Convert the video to MP3 using FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => resolve())
        .save(outputPath);
    });

    try {
      const audioData = await readFile(outputPath);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename=${outputFilename}`);
      res.status(200).send(audioData);
    } catch (readErr) {
      console.error('Read error:', readErr);
      res.status(500).json({ error: 'Error reading the converted file.' });
    } finally {
      // Clean up the temporary files
      try {
        await unlink(inputPath);
        await unlink(outputPath);
      } catch (unlinkErr) {
        console.error('Error cleaning up files:', unlinkErr);
      }
    }
  } catch (error: any) {
    console.error('Error processing video:', error);
    res.status(500).json({ error: 'Error processing the video file.' });
  }
} 