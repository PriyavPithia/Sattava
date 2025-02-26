import { getTranscript } from '../utils/transcript';

export async function fetchYoutubeTranscript(videoId: string) {
  try {
    console.log('Attempting to fetch transcript for video ID:', videoId);
    const transcript = await getTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      console.error('Empty transcript returned for video ID:', videoId);
      throw new Error('No transcript data found');
    }
    
    console.log('Successfully fetched transcript with', transcript.length, 'segments');
    return transcript;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    
    // Try to provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('Could not find the language') || 
        errorMessage.includes('No captions') ||
        errorMessage.includes('No transcript')) {
      throw new Error('This video does not have available captions. Please try another video or check if captions are enabled.');
    }
    
    if (errorMessage.includes('Video unavailable') || errorMessage.includes('not exist')) {
      throw new Error('This video does not exist or is unavailable.');
    }
    
    // Generic fallback error
    throw new Error('Failed to fetch transcript. Please try again or use a different video.');
  }
} 