import { getTranscript } from '../utils/transcript';

export async function fetchYoutubeTranscript(videoId: string) {
  try {
    console.log('Attempting to fetch transcript for video ID:', videoId);
    
    if (!videoId) {
      console.error('Invalid video ID provided:', videoId);
      throw new Error('Invalid YouTube video ID');
    }
    
    console.log('Calling getTranscript function...');
    const transcript = await getTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      console.error('Empty transcript returned for video ID:', videoId);
      throw new Error('No transcript data found');
    }
    
    console.log('Successfully fetched transcript with', transcript.length, 'segments');
    return transcript;
  } catch (error) {
    console.error('Error fetching transcript:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error),
      videoId,
      timestamp: new Date().toISOString()
    });
    
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
    
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      throw new Error('Network error while fetching transcript. Please check your internet connection and try again.');
    }
    
    // Generic fallback error with more details
    throw new Error(`Failed to fetch transcript: ${errorMessage}. Please try again or use a different video.`);
  }
} 