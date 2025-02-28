import React, { useState, useRef, useEffect } from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

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
  const [ffmpeg] = useState(() => new FFmpeg());
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addDebugInfo = (stage: string, details: string) => {
    setDebugInfo(prev => [...prev, {
      stage,
      details,
      timestamp: new Date().toISOString()
    }]);
  };

  // Initialize FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        addDebugInfo('FFmpeg', 'Starting FFmpeg initialization');
        
        // Configure FFmpeg
        ffmpeg.on('log', ({ message }) => {
          addDebugInfo('FFmpeg Log', message);
        });

        ffmpeg.on('progress', ({ progress }) => {
          const percentage = Math.round(progress * 100);
          setProgress(`Processing: ${percentage}%`);
        });

        // Load FFmpeg
        await ffmpeg.load();
        
        setIsFFmpegLoaded(true);
        addDebugInfo('FFmpeg', 'FFmpeg initialized successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during FFmpeg loading';
        setError(errorMessage);
        onError(`Failed to initialize video processing: ${errorMessage}`);
        addDebugInfo('FFmpeg Error', errorMessage);
      }
    };

    loadFFmpeg();
  }, [onError]);

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isFFmpegLoaded) {
      setError('FFmpeg is not initialized yet. Please wait and try again.');
      return;
    }

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

        // Convert video to audio using FFmpeg
        const inputFileName = 'input.mp4';
        const outputFileName = 'output.mp3';

        // Write the video file to FFmpeg's virtual filesystem
        ffmpeg.writeFile(inputFileName, await fetchFile(file));

        // Extract audio using FFmpeg
        await ffmpeg.exec([
          '-i', inputFileName,
          '-vn',                // Disable video
          '-acodec', 'libmp3lame', // Use MP3 codec
          '-ab', '128k',        // Audio bitrate
          '-ar', '44100',       // Sample rate
          outputFileName
        ]);

        // Read the output audio file
        const audioData = await ffmpeg.readFile(outputFileName);
        const audioBlob = new Blob([audioData], { type: 'audio/mp3' });

        // Clean up files
        await ffmpeg.deleteFile(inputFileName);
        await ffmpeg.deleteFile(outputFileName);

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
          disabled={isLoading || isProcessingContent || !isFFmpegLoaded}
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