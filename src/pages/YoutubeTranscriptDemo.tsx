import React, { useState } from 'react';
import YoutubeClient from '../components/YoutubeClient';
import YoutubeTranscriptViewer from '../components/YoutubeTranscriptViewer';
import { extractVideoId } from '../utils/youtube';

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  start?: number;
}

const YoutubeTranscriptDemo: React.FC = () => {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);

  const handleTranscriptGenerated = (transcriptData: TranscriptSegment[]) => {
    setTranscript(transcriptData);
    setIsProcessing(false);
    
    // Extract video ID from URL
    const extractedVideoId = extractVideoId(url);
    if (extractedVideoId) {
      setVideoId(extractedVideoId);
    }
    
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsProcessing(false);
    setTranscript([]);
  };

  const resetDemo = () => {
    setUrl('');
    setTranscript([]);
    setVideoId(null);
    setError(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">YouTube Transcript Demo</h1>
      
      {!videoId || transcript.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <YoutubeClient
            url={url}
            setUrl={setUrl}
            onTranscriptGenerated={handleTranscriptGenerated}
            onError={handleError}
            isProcessingContent={isProcessing}
          />
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              Video with Transcript
            </h2>
            <button
              onClick={resetDemo}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm transition-colors"
            >
              Try Another Video
            </button>
          </div>
          
          <YoutubeTranscriptViewer
            videoId={videoId}
            transcript={transcript}
          />
        </div>
      )}
      
      <div className="mt-8 text-sm text-gray-500">
        <h3 className="font-medium mb-2">How to use:</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Enter a YouTube video URL in the input field</li>
          <li>Click "Process YouTube Video" to fetch the transcript</li>
          <li>The video will play alongside its transcript</li>
          <li>Click on any transcript segment to jump to that part of the video</li>
          <li>The currently playing segment will be highlighted</li>
        </ol>
        <p className="mt-2">
          Note: This demo only works with YouTube videos that have captions/subtitles available.
        </p>
      </div>
    </div>
  );
};

export default YoutubeTranscriptDemo; 