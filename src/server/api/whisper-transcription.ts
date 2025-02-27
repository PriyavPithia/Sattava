import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../../uploads');
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
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

router.post('/whisper-transcription', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.VITE_OPENAI_API_KEY,
    });

    // Create a readable stream from the uploaded file
    const fileStream = fs.createReadStream(req.file.path);

    // Send to OpenAI Whisper API
    const response = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'json',
      temperature: 0.3,
      language: 'en'
    });

    // Clean up: Delete the uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting file:', err);
    });

    // Return the transcription
    res.json({
      transcription: response.text,
      type: 'speech'
    });

  } catch (error: any) {
    console.error('Error processing audio:', error);
    res.status(500).json({
      error: error.message || 'Error processing audio file'
    });
  }
});

export default router; 