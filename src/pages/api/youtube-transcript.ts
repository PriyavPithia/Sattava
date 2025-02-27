import { NextApiRequest, NextApiResponse } from 'next';
import { YoutubeTranscript } from 'youtube-transcript';

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
    const formattedTranscript = transcript.map(item => ({
      text: item.text,
      start: item.offset / 1000, // Convert to seconds
      duration: item.duration / 1000 // Convert to seconds
    }));

    return res.status(200).json({ transcript: formattedTranscript });
  } catch (error) {
    console.error('Error fetching YouTube transcript:', error);
    return res.status(500).json({ error: 'Failed to fetch transcript' });
  }
} 