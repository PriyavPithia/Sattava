import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { extractVideoId } from '../../utils/youtube';
import axios from 'axios';

interface YoutubeClientProps {
  url: string;
  setUrl: (url: string) => void;
  onTranscriptGenerated: (transcript: any) => void;
  onError: (error: string) => void;
  isProcessingContent: boolean;
}

const YoutubeClient: React.FC<YoutubeClientProps> = ({
  url,
  setUrl,
  onTranscriptGenerated,
  onError,
  isProcessingContent
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with URL:', url);
    
    // Reset error state
    setErrorMessage(null);
    
    const videoId = extractVideoId(url);
    console.log('Extracted video ID:', videoId);
    
    if (!videoId) {
      const error = 'Invalid YouTube URL. Please enter a valid YouTube video URL.';
      setErrorMessage(error);
      onError(error);
      return;
    }

    setIsLoading(true);

    try {
      console.log('Fetching transcript for video ID:', videoId);
      
      // Use the server-side API endpoint instead of direct fetching
      const response = await axios.post('/api/youtube-transcript', { videoId });
      const transcript = response.data.transcript;
      
      if (!transcript || transcript.length === 0) {
        throw new Error('No transcript data available for this video');
      }
      
      console.log('Transcript received:', transcript.length, 'segments');
      onTranscriptGenerated(transcript);
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      
      let errorMsg = 'Failed to fetch transcript. Please try another video.';
      
      // Handle axios error responses
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.data && error.response.data.error) {
          errorMsg = error.response.data.error;
        } else if (error.response.status === 404) {
          errorMsg = 'No captions found for this video. Please try another video.';
        } else if (error.response.status === 500) {
          errorMsg = 'Server error while fetching transcript. Please try again later.';
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorMsg = 'Network error. Please check your internet connection and try again.';
      } else if (error.message) {
        // Something happened in setting up the request that triggered an Error
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
      onError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium mb-2">YouTube URL</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              // Clear error when user starts typing
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className={`w-full px-3 py-2 border rounded-lg ${
              errorMessage ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          
          {errorMessage && (
            <div className="flex items-start text-red-500 text-sm mt-1">
              <AlertCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading || isProcessingContent || !url}
            className="w-full flex items-center justify-center px-4 py-2 bg-black text-white rounded-lg disabled:opacity-50 hover:bg-gray-800 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Fetching Transcript...
              </>
            ) : (
              'Process YouTube Video'
            )}
          </button>
        </form>
      </div>

      {isProcessingContent && (
        <div className="mt-4 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Processing content...</p>
        </div>
      )}
      
      <div className="text-xs text-gray-500 mt-2">
        <p>Note: This feature requires the YouTube video to have captions/subtitles enabled.</p>
        <p className="mt-1">If you're having trouble, try using a video with official captions rather than auto-generated ones.</p>
      </div>
    </div>
  );
};

export default YoutubeClient; 