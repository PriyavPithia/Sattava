import React, { useState } from 'react';
import { YoutubeTranscript } from 'youtube-transcript';
import { Loader2 } from 'lucide-react';

interface TranscriptResponse {
  text: string;
  offset: number;
  duration: number;
}

interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

interface YoutubeTranscriptProps {
  videoId: string;
  onTranscriptGenerated: (transcript: { transcripts: TranscriptItem[] }) => void;
  onError: (error: string) => void;
}

const YoutubeTranscriptComponent: React.FC<YoutubeTranscriptProps> = ({
  videoId,
  onTranscriptGenerated,
  onError,
}) => {
  const [loading, setLoading] = useState(false);

  const handleGetTranscript = async () => {
    if (!videoId) {
      onError('Please enter a valid YouTube URL');
      return;
    }

    setLoading(true);
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      onTranscriptGenerated({
        transcripts: transcript.map((item: TranscriptResponse) => ({
          text: item.text,
          start: item.offset / 1000, // Convert milliseconds to seconds
          duration: item.duration / 1000 // Convert milliseconds to seconds
        }))
      });
    } catch (error) {
      console.error('Error getting transcript:', error);
      onError('Failed to get transcript. Please make sure captions are available for this video.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={handleGetTranscript}
        disabled={loading}
        className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-white ${
          loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Getting Transcript...
          </>
        ) : (
          'Get Transcript'
        )}
      </button>
    </div>
  );
};

export default YoutubeTranscriptComponent; 