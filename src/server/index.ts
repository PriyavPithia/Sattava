import express from 'express';
import cors from 'cors';
import whisperTranscriptionRouter from './api/whisper-transcription';
import youtubeTranscriptRouter from './api/youtube-transcript';

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Use the whisper transcription route
app.use('/api', whisperTranscriptionRouter);

// Use the YouTube transcript route
app.use('/api', youtubeTranscriptRouter);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 