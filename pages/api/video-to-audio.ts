import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Parse the form data
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 500 * 1024 * 1024, // 500MB limit
    });

    // Parse form data
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
    const videoPath = file.filepath;
    const audioPath = path.join(uploadsDir, `output-${Date.now()}.mp3`);

    try {
      // Convert video to audio using FFmpeg
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -ab 128k -ar 44100 "${audioPath}"`;
      await execAsync(ffmpegCommand);

      // Read the audio file
      const audioBuffer = fs.readFileSync(audioPath);
      const audioBase64 = audioBuffer.toString('base64');

      // Clean up files
      fs.unlinkSync(videoPath);
      fs.unlinkSync(audioPath);

      // Return the audio data
      return res.status(200).json({
        success: true,
        audio: audioBase64,
        mimeType: 'audio/mp3'
      });
    } catch (error) {
      // Clean up files in case of error
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      
      console.error('FFmpeg error:', error);
      return res.status(500).json({ error: 'Failed to convert video to audio' });
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error processing video' });
  }
} 