import React, { useState } from 'react';
import { fetchYoutubeTranscript } from '../api/transcript';

// Define types
interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

interface TranscriptState {
  items: TranscriptItem[];
  isLoading: boolean;
  error: string | null;
}

type TimeInterval = 1 | 15 | 30 | 60 | 120 | 300;

// Import the utility functions from above
import { extractVideoId, formatTime, groupTranscriptByInterval } from '../utils/youtube';

export function YouTubeTranscript() {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState<TranscriptState>({
    items: [],
    isLoading: false,
    error: null,
  });
  const [timeInterval, setTimeInterval] = useState<TimeInterval>(30);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      setTranscript(prev => ({ ...prev, error: 'Invalid YouTube URL' }));
      return;
    }

    setTranscript(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await fetchYoutubeTranscript(videoId);
      
      setTranscript(prev => ({
        ...prev,
        items: data,
        isLoading: false,
      }));
    } catch (error) {
      setTranscript(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch transcript',
        isLoading: false,
      }));
    }
  };

  const displayedItems = groupTranscriptByInterval(transcript.items, timeInterval);

  const intervals: { value: TimeInterval; label: string }[] = [
    { value: 1, label: 'No grouping' },
    { value: 15, label: '15 seconds' },
    { value: 30, label: '30 seconds' },
    { value: 60, label: '1 minute' },
    { value: 120, label: '2 minutes' },
    { value: 300, label: '5 minutes' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-4">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <button
                type="submit"
                disabled={transcript.isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Extract
              </button>
            </div>
          </form>
        </div>
      </div>

      {transcript.isLoading && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700">Loading transcript...</p>
        </div>
      )}

      {transcript.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{transcript.error}</p>
        </div>
      )}

      {transcript.items.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Transcript</h2>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap gap-2">
                {intervals.map(interval => (
                  <button
                    key={interval.value}
                    onClick={() => setTimeInterval(interval.value)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      timeInterval === interval.value
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {interval.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {displayedItems.map((item, index) => (
              <div key={index} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    {formatTime(item.offset / 1000)}
                  </span>
                  <p className="text-gray-700">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 