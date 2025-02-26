import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { extractVideoId } from '../../utils/youtube';
import { getTranscript } from '../../utils/transcript';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      onError('Invalid YouTube URL');
      return;
    }

    setIsLoading(true);

    try {
      const transcript = await getTranscript(videoId);
      onTranscriptGenerated(transcript);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to fetch transcript');
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
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button
            type="submit"
            disabled={isLoading || isProcessingContent || !url}
            className="w-full flex items-center justify-center px-4 py-2 bg-black text-white rounded-lg disabled:opacity-50"
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
    </div>
  );
};

export default YoutubeClient; 