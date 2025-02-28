import React, { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';

interface VideoToTextProps {
  onTranscriptionComplete: (transcript: string) => void;
  onError: (error: string) => void;
  isProcessingContent: boolean;
}

interface DebugInfo {
  stage: string;
  details: string;
  timestamp: string;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB limit

const VideoToText: React.FC<VideoToTextProps> = ({
  onTranscriptionComplete,
  onError,
  isProcessingContent
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<DebugInfo[]>([]);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addDebugInfo = (stage: string, details: string) => {
    setDebugInfo(prev => [...prev, {
      stage,
      details,
      timestamp: new Date().toISOString()
    }]);
  };

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      addDebugInfo('File Selection', `Selected file: ${file.name}, Size: ${(file.size / (1024 * 1024)).toFixed(2)}MB, Type: ${file.type}`);
      
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = `Video file size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
        setError(errorMsg);
        addDebugInfo('Error', errorMsg);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setProgress('Processing video...');

        // Create form data for video upload
        const formData = new FormData();
        formData.append('video', file);

        // Send video to server for audio extraction
        addDebugInfo('Processing', 'Sending video to server for audio extraction');
        const response = await fetch('/api/video-to-audio', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to process video');
        }

        const data = await response.json();
        addDebugInfo('Processing', 'Audio extraction completed successfully');

        // Convert base64 audio to blob
        const audioBlob = new Blob(
          [Buffer.from(data.audio, 'base64')],
          { type: data.mimeType }
        );

        // Start transcription
        await transcribeAudio(audioBlob);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to process video';
        setError(errorMessage);
        onError(errorMessage);
        addDebugInfo('Error', `Processing failed: ${errorMessage}`);
      } finally {
        setIsLoading(false);
        setProgress('');
      }
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setProgress('Transcribing audio...');
    addDebugInfo('Transcription', 'Starting audio transcription with Whisper API');
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'output.mp3');
      formData.append('model', 'whisper-1');

      addDebugInfo('Transcription', 'Sending request to Whisper API');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      if (data.text) {
        addDebugInfo('Transcription', 'Transcription completed successfully');
        onTranscriptionComplete(data.text);
      } else {
        throw new Error('No transcription text received');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setError(errorMessage);
      onError(errorMessage);
      addDebugInfo('Error', `Transcription failed: ${errorMessage}`);
    }
  };

  return (
    <div>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleVideoChange}
          accept="video/*"
          className="hidden"
          disabled={isLoading || isProcessingContent}
        />
        {isLoading || isProcessingContent ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="mt-2 text-sm text-gray-600">{progress || 'Processing...'}</p>
          </div>
        ) : (
          <div 
            className="flex flex-col items-center cursor-pointer"
            onClick={handleFileClick}
          >
            <Upload className="w-12 h-12 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-900">Click to upload video</p>
            <p className="mt-1 text-xs text-gray-500">or drag and drop</p>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-2 flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <p className="mt-2 text-sm text-gray-500">
        Upload a video file (max {MAX_FILE_SIZE / (1024 * 1024)}MB) to automatically transcribe its content.
      </p>

      {/* Debug Information Section */}
      <div className="mt-4">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <span>{showDebug ? 'Hide' : 'Show'} Debug Info</span>
        </button>
        
        {showDebug && debugInfo.length > 0 && (
          <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm">
            <div className="space-y-2">
              {debugInfo.map((info, index) => (
                <div key={index} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">{new Date(info.timestamp).toLocaleTimeString()}</span>
                    <span className="font-medium">{info.stage}</span>
                  </div>
                  <p className="text-gray-600 ml-4">{info.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoToText; 