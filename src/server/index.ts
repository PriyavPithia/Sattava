import express, { Request, Response } from 'express';
import cors from 'cors';
import whisperTranscriptionRouter from './api/whisper-transcription';
import path from 'path';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3000;

// Configure ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
  console.log('FFmpeg path set to:', ffmpegStatic);
} else {
  console.error('FFmpeg static path not found!');
}

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('Created uploads directory:', uploadDir);
    }
    console.log('File will be uploaded to:', uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const filename = Date.now() + '-' + file.originalname;
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('Received file:', file.originalname, 'Type:', file.mimetype);
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Add error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Video conversion endpoint
app.post('/api/convert', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
  console.log('Received request to /api/convert');
  console.log('Request headers:', req.headers);
  
  if (!req.file) {
    console.error('No file in request');
    res.status(400).json({ error: 'No video file uploaded' });
    return;
  }

  console.log('File received:', {
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });

  const inputPath = req.file.path;
  const outputPath = path.join(path.dirname(inputPath), `${Date.now()}-output.mp3`);
  
  console.log('Input path:', inputPath);
  console.log('Output path:', outputPath);

  try {
    console.log('Starting FFmpeg conversion');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .on('start', (commandLine: string) => {
          console.log('FFmpeg process started:', commandLine);
        })
        .on('progress', function(this: any, progress: { percent?: number }) {
          console.log('Processing:', progress.percent ?? 'unknown', '% done');
        })
        .on('error', (err: Error) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('FFmpeg processing finished');
          resolve();
        })
        .save(outputPath);
    });

    console.log('Sending converted file');
    res.sendFile(outputPath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up files
      console.log('Cleaning up temporary files');
      fs.unlink(inputPath, (err) => {
        if (err) console.error('Error deleting input file:', err);
        else console.log('Input file deleted:', inputPath);
      });
      fs.unlink(outputPath, (err) => {
        if (err) console.error('Error deleting output file:', err);
        else console.log('Output file deleted:', outputPath);
      });
    });
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'Error converting video to audio', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Use the whisper transcription route
app.use('/api', whisperTranscriptionRouter);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 