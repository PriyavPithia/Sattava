import { TranscriptSegment, TranscriptGroup, CurrentGroup } from './types';
import { YoutubeTranscript } from 'youtube-transcript';
import axios from 'axios';

export const groupTranscriptsByDuration = (transcripts: TranscriptSegment[], duration: number = 30): TranscriptGroup[] => {
  if (!transcripts || transcripts.length === 0) return [];

  const groups: TranscriptGroup[] = [];
  let currentGroup: CurrentGroup = {
    startTime: transcripts[0].start,
    endTime: transcripts[0].start + duration,
    texts: []
  };

  transcripts.forEach((segment) => {
    if (segment.start <= currentGroup.endTime) {
      currentGroup.texts.push(segment.text);
    } else {
      if (currentGroup.texts.length > 0) {
        groups.push({
          startTime: currentGroup.startTime,
          endTime: currentGroup.endTime,
          text: currentGroup.texts.join(' ')
        });
      }
      currentGroup = {
        startTime: segment.start,
        endTime: segment.start + duration,
        texts: [segment.text]
      };
    }
  });

  if (currentGroup.texts.length > 0) {
    groups.push({
      startTime: currentGroup.startTime,
      endTime: currentGroup.endTime,
      text: currentGroup.texts.join(' ')
    });
  }

  return groups;
};

export const calculateTotalDuration = (transcripts: TranscriptSegment[]): number => {
  if (!transcripts || transcripts.length === 0) return 0;
  const lastSegment = transcripts[transcripts.length - 1];
  return lastSegment.start + lastSegment.duration;
};

export const formatTime = (seconds: number): string => {
  if (typeof seconds !== 'number') return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const formatDurationLabel = (duration: number): string => {
  const minutes = Math.floor(duration / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
};

// Improved implementation using youtube-transcript package
export async function fetchTranscriptDirectly(videoId: string) {
  console.log('Fetching transcript directly for video ID:', videoId);
  
  try {
    // Try using the youtube-transcript package
    console.log('Using YoutubeTranscript.fetchTranscript');
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      throw new Error('No transcript data returned');
    }
    
    console.log('Transcript fetched successfully with package:', transcript.length, 'segments');
    
    // Transform the transcript data to match our expected format
    const formattedTranscript = transcript.map(item => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration,
      // Add compatibility with our TranscriptSegment interface
      start: item.offset / 1000 // Convert milliseconds to seconds for compatibility
    }));
    
    return formattedTranscript;
  } catch (error) {
    console.error('Error fetching transcript with youtube-transcript package:', error);
    
    // Try fallback method with proxy
    try {
      console.log('Trying fallback method with proxy');
      return await fetchTranscriptWithProxy(videoId);
    } catch (proxyError) {
      console.error('Fallback method failed:', proxyError);
      throw new Error(
        'Failed to fetch transcript. This video may not have captions available, ' +
        'or the captions may be disabled. Please try another video or check if captions are enabled.'
      );
    }
  }
}

// Fallback method using proxy
async function fetchTranscriptWithProxy(videoId: string) {
  console.log('Fetching transcript via proxy for video ID:', videoId);
  
  // Use a CORS proxy to fetch the YouTube page
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  
  console.log('Fetching via proxy:', proxyUrl);
  const response = await axios.get(proxyUrl);
  const html = response.data;
  
  // Extract captions data from the HTML
  const captionsRegex = /"captionTracks":\[(.*?)\]/;
  const match = html.match(captionsRegex);
  
  if (!match || !match[1]) {
    console.error('No captions found in the video');
    throw new Error('No captions found for this video');
  }
  
  console.log('Captions data found');
  
  // Parse the captions data
  const captionsData = JSON.parse(`[${match[1]}]`);
  if (!captionsData || captionsData.length === 0) {
    throw new Error('No captions available for this video');
  }
  
  // Get the first available caption track (usually English)
  const firstCaption = captionsData[0];
  const captionUrl = firstCaption.baseUrl;
  
  console.log('Fetching captions from URL via proxy');
  
  // Fetch the actual transcript through the proxy
  const captionResponse = await axios.get(`https://api.allorigins.win/raw?url=${encodeURIComponent(captionUrl)}`);
  const transcript = captionResponse.data;
  
  // Parse the XML transcript
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(transcript, 'text/xml');
  const textElements = xmlDoc.getElementsByTagName('text');
  
  // Convert to our transcript format
  const result = [];
  for (let i = 0; i < textElements.length; i++) {
    const text = textElements[i].textContent || '';
    const start = parseFloat(textElements[i].getAttribute('start') || '0');
    const duration = parseFloat(textElements[i].getAttribute('dur') || '0');
    
    result.push({
      text,
      offset: start * 1000, // Convert to milliseconds
      duration: duration * 1000, // Convert to milliseconds
      start: start // Add start in seconds for compatibility
    });
  }
  
  console.log('Transcript parsed successfully via proxy, entries:', result.length);
  return result;
}

export async function getTranscript(videoId: string) {
  console.log('Fetching transcript for video ID:', videoId);
  return fetchTranscriptDirectly(videoId);
} 