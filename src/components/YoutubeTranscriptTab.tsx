import React, { useState } from 'react';
import { YoutubeTranscript } from 'youtube-transcript';
import { Loader2 } from 'lucide-react';

interface YoutubeTranscriptTabProps {
  videoId: string;
  onTranscriptFetched: (transcript: any) => void;
}

const YoutubeTranscriptTab: React.FC<YoutubeTranscriptTabProps> = ({ videoId, onTranscriptFetched }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscript = async () => {
    try {
      setLoading(true);
      setError(null);
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      onTranscriptFetched(transcript);
    } catch (err) {
      setError('Failed to fetch transcript. Please make sure the video has captions available.');
      console.error('Transcript fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={fetchTranscript}
        disabled={loading}
        className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 ${
          loading
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Fetching transcript...</span>
          </>
        ) : (
          <span>Fetch Transcript</span>
        )}
      </button>
      
      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default YoutubeTranscriptTab; 