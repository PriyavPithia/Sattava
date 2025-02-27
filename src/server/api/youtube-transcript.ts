import express from 'express';
import { YoutubeTranscript } from 'youtube-transcript';

const router = express.Router();

router.post('/youtube-transcript', async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ error: 'No transcript found for this video' });
    }
    
    // Transform the transcript data to match our expected format
    const formattedTranscript = transcript.map(item => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration,
      start: Math.floor(item.offset / 1000) // Convert milliseconds to seconds
    }));
    
    return res.status(200).json({ transcript: formattedTranscript });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch transcript. This video may not have captions available.'
    });
  }
});

export default router; 