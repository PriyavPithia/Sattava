import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import whisperTranscriptionRouter from './api/whisper-transcription';
import youtubeTranscriptRouter from './api/youtube-transcript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));
}

// Use the whisper transcription route
app.use('/api', whisperTranscriptionRouter);

// Use the YouTube transcript route
app.use('/api', youtubeTranscriptRouter);

// Handle client-side routing in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
}); 