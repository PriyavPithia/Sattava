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
}

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  }
});

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Video conversion endpoint
app.post('/api/convert', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No video file uploaded' });
    return;
  }

  const inputPath = req.file.path;
  const outputPath = path.join(path.dirname(inputPath), `${Date.now()}-output.mp3`);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .on('error', (err) => {
          console.error('Error:', err);
          reject(err);
        })
        .on('end', () => {
          resolve();
        })
        .save(outputPath);
    });

    res.sendFile(outputPath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up files
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (error) {
    res.status(500).json({ error: 'Error converting video to audio' });
  }
});

// Use the whisper transcription route
app.use('/api', whisperTranscriptionRouter);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 