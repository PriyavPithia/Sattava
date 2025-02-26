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

// Main function to get transcript with multiple fallback methods
export async function getTranscript(videoId: string) {
  console.log('Getting transcript for video ID:', videoId);
  
  try {
    // Method 1: Try using youtube-transcript package first
    console.log('Attempting to fetch transcript using youtube-transcript package');
    const transcript = await fetchTranscriptDirectly(videoId);
    
    if (transcript && transcript.length > 0) {
      console.log('Successfully fetched transcript using youtube-transcript package');
      return transcript;
    }
    
    // Method 2: Try using SearchAPI.io if first method fails
    console.log('First method failed, trying SearchAPI.io');
    const searchApiTranscript = await fetchTranscriptWithSearchApi(videoId);
    
    if (searchApiTranscript && searchApiTranscript.length > 0) {
      console.log('Successfully fetched transcript using SearchAPI.io');
      return searchApiTranscript;
    }
    
    // Method 3: Try using proxy method if both previous methods fail
    console.log('Second method failed, trying proxy method');
    const proxyTranscript = await fetchTranscriptWithProxy(videoId);
    
    if (proxyTranscript && proxyTranscript.length > 0) {
      console.log('Successfully fetched transcript using proxy method');
      return proxyTranscript;
    }
    
    throw new Error('All transcript fetching methods failed');
  } catch (error) {
    console.error('Error in getTranscript:', error);
    throw error;
  }
}

// Method 1: Direct fetch using youtube-transcript package
export async function fetchTranscriptDirectly(videoId: string) {
  try {
    console.log('Fetching transcript directly for video ID:', videoId);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      console.warn('Empty transcript returned from direct fetch');
      throw new Error('No transcript data found');
    }
    
    console.log('Direct fetch successful, found', transcript.length, 'segments');
    return transcript;
  } catch (error) {
    console.error('Error in fetchTranscriptDirectly:', error);
    throw error;
  }
}

// Method 2: Using SearchAPI.io
async function fetchTranscriptWithSearchApi(videoId: string) {
  try {
    console.log('Fetching transcript via SearchAPI.io for video ID:', videoId);
    
    const apiKey = import.meta.env.VITE_SEARCH_API_KEY;
    if (!apiKey) {
      console.warn('No SearchAPI.io API key found');
      throw new Error('SearchAPI.io API key not configured');
    }
    
    const response = await axios.get('https://www.searchapi.io/api/v1/search', {
      params: {
        engine: 'youtube_transcripts',
        video_id: videoId,
        api_key: apiKey
      }
    });
    
    if (!response.data || !response.data.transcripts || response.data.transcripts.length === 0) {
      console.warn('No transcript data in SearchAPI.io response');
      throw new Error('No transcript data found in API response');
    }
    
    console.log('SearchAPI.io fetch successful, found', response.data.transcripts.length, 'segments');
    return response.data.transcripts;
  } catch (error) {
    console.error('Error in fetchTranscriptWithSearchApi:', error);
    throw error;
  }
}

// Method 3: Using proxy to bypass CORS
async function fetchTranscriptWithProxy(videoId: string) {
  try {
    console.log('Fetching transcript via proxy for video ID:', videoId);
    
    // Try multiple CORS proxies in case one fails
    const proxyUrls = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      `https://corsproxy.io/?${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      `https://cors-anywhere.herokuapp.com/https://www.youtube.com/watch?v=${videoId}`
    ];
    
    let html = '';
    let proxySuccess = false;
    
    // Try each proxy until one works
    for (const proxyUrl of proxyUrls) {
      try {
        console.log('Trying proxy:', proxyUrl);
        const response = await axios.get(proxyUrl, { timeout: 10000 });
        html = response.data;
        proxySuccess = true;
        console.log('Proxy fetch successful');
        break;
      } catch (proxyError) {
        console.warn(`Proxy ${proxyUrl} failed:`, proxyError.message);
        continue;
      }
    }
    
    if (!proxySuccess) {
      throw new Error('All proxies failed to fetch the YouTube page');
    }
    
    // Try multiple regex patterns to extract captions data
    const regexPatterns = [
      /"captionTracks":\[(.*?)\]/,
      /captionTracks"?:\s*?\[(.*?)\]/,
      /\\"captionTracks\\":\[(.*?)\]/
    ];
    
    let match = null;
    for (const pattern of regexPatterns) {
      match = html.match(pattern);
      if (match && match[1]) {
        console.log('Found captions data with pattern:', pattern);
        break;
      }
    }
    
    if (!match || !match[1]) {
      console.error('No captions found in the video');
      throw new Error('No captions found for this video');
    }
    
    console.log('Captions data found');
    
    // Clean up the JSON string before parsing
    let captionDataStr = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    
    try {
      // Try to parse the captions data
      const captionsData = JSON.parse(`[${captionDataStr}]`);
      
      if (!captionsData || captionsData.length === 0) {
        throw new Error('No captions available for this video');
      }
      
      // Get the first available caption track (usually English)
      const firstCaption = captionsData[0];
      const captionUrl = firstCaption.baseUrl;
      
      console.log('Fetching captions from URL via proxy');
      
      // Try multiple proxies for the caption URL too
      let transcript = '';
      let captionProxySuccess = false;
      
      for (const proxyBase of ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?']) {
        try {
          const captionProxyUrl = `${proxyBase}${encodeURIComponent(captionUrl)}`;
          console.log('Trying caption proxy:', captionProxyUrl);
          const captionResponse = await axios.get(captionProxyUrl, { timeout: 8000 });
          transcript = captionResponse.data;
          captionProxySuccess = true;
          console.log('Caption proxy fetch successful');
          break;
        } catch (captionProxyError) {
          console.warn('Caption proxy failed:', captionProxyError.message);
          continue;
        }
      }
      
      if (!captionProxySuccess) {
        throw new Error('Failed to fetch captions from all proxies');
      }
      
      // Use regex-based parsing which works in both browser and Node.js
      console.log('Using regex-based parsing');
      const result = [];
      const regex = /<text start="([\d\.]+)" dur="([\d\.]+)"[^>]*>(.*?)<\/text>/g;
      let textMatch;
      
      while ((textMatch = regex.exec(transcript)) !== null) {
        const start = parseFloat(textMatch[1]);
        const duration = parseFloat(textMatch[2]);
        const text = textMatch[3].replace(/&amp;/g, '&')
                               .replace(/&lt;/g, '<')
                               .replace(/&gt;/g, '>')
                               .replace(/&quot;/g, '"')
                               .replace(/&#39;/g, "'");
        
        result.push({
          text,
          start,
          duration,
          offset: start * 1000,
        });
      }
      
      if (result.length === 0) {
        throw new Error('Failed to parse transcript data');
      }
      
      console.log('Regex parsing successful, found', result.length, 'segments');
      return result;
      
    } catch (parseError) {
      console.error('Error parsing caption data:', parseError);
      throw new Error('Failed to parse caption data from YouTube');
    }
    
  } catch (error) {
    console.error('Error in fetchTranscriptWithProxy:', error);
    throw error;
  }
} 