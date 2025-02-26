import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { YoutubeTranscript } from 'youtube-transcript';

// Define the transcript item interface
interface TranscriptItem {
  text: string;
  offset: number;
  duration: number;
  start: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    // Try using the youtube-transcript package
    console.log('Fetching transcript for video ID:', videoId);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      throw new Error('No transcript data returned');
    }
    
    // Transform the transcript data to match our expected format
    const formattedTranscript = transcript.map(item => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration,
      start: item.offset / 1000 // Convert milliseconds to seconds for compatibility
    }));
    
    return res.status(200).json({ transcript: formattedTranscript });
  } catch (error) {
    console.error('Error fetching transcript with youtube-transcript package:', error);
    
    // Try fallback method
    try {
      // Fetch the YouTube page directly (server-side, so no CORS issues)
      const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`);
      const html = response.data;
      
      // Extract captions data from the HTML
      const captionsRegex = /"captionTracks":\[(.*?)\]/;
      const match = html.match(captionsRegex);
      
      if (!match || !match[1]) {
        return res.status(404).json({ 
          error: 'No captions found for this video' 
        });
      }
      
      // Parse the captions data
      const captionsData = JSON.parse(`[${match[1]}]`);
      if (!captionsData || captionsData.length === 0) {
        return res.status(404).json({ 
          error: 'No captions available for this video' 
        });
      }
      
      // Get the first available caption track (usually English)
      const firstCaption = captionsData[0];
      const captionUrl = firstCaption.baseUrl;
      
      // Fetch the actual transcript
      const captionResponse = await axios.get(captionUrl);
      const transcript = captionResponse.data;
      
      // Since we're in a Node.js environment, we'll use a different approach to parse XML
      // We'll use a simple regex approach instead of DOMParser
      const textRegex = /<text start="([\d\.]+)" dur="([\d\.]+)"[^>]*>(.*?)<\/text>/g;
      const result: TranscriptItem[] = [];
      
      let match2;
      while ((match2 = textRegex.exec(transcript)) !== null) {
        const start = parseFloat(match2[1]);
        const duration = parseFloat(match2[2]);
        // Decode HTML entities in the text
        const text = match2[3]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        
        result.push({
          text,
          offset: start * 1000, // Convert to milliseconds
          duration: duration * 1000, // Convert to milliseconds
          start: start // Add start in seconds for compatibility
        });
      }
      
      if (result.length === 0) {
        return res.status(404).json({ 
          error: 'Failed to parse captions for this video' 
        });
      }
      
      return res.status(200).json({ transcript: result });
    } catch (fallbackError) {
      console.error('Fallback method failed:', fallbackError);
      return res.status(500).json({ 
        error: 'Failed to fetch transcript. This video may not have captions available, or the captions may be disabled.' 
      });
    }
  }
} 