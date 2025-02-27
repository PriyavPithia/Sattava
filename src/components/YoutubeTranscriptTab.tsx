import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface YoutubeTranscriptTabProps {
  videoId: string;
  onTranscriptFetched: (transcript: any) => void;
}

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

const YoutubeTranscriptTab: React.FC<YoutubeTranscriptTabProps> = ({ videoId, onTranscriptFetched }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscript = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the SearchAPI endpoint that's already set up in the app
      const response = await fetch(`https://www.searchapi.io/api/v1/search?engine=youtube_transcripts&video_id=${videoId}&api_key=${import.meta.env.VITE_SEARCH_API_KEY}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transcript');
      }

      const data = await response.json();
      
      // Transform the data to match the expected format
      const transcript = data.transcripts.map((segment: any) => ({
        text: segment.text,
        offset: segment.start * 1000, // Convert to milliseconds
        duration: segment.duration * 1000 // Convert to milliseconds
      }));

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