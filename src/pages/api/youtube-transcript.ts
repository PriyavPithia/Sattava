import { NextApiRequest, NextApiResponse } from 'next';
import { YoutubeTranscript } from 'youtube-transcript';

interface TranscriptItem {
  text: string;
  offset: number;
  duration: number;
  start: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const formattedTranscript: TranscriptItem[] = transcript.map(item => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration,
      start: Math.floor(item.offset / 1000) // Convert milliseconds to seconds and ensure it's a number
    }));
    
    return res.status(200).json({ transcript: formattedTranscript });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch transcript. This video may not have captions available.'
    });
  }
} 