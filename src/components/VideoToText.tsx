import React, { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface VideoToTextProps {
  onTranscriptionComplete: (transcript: string) => void;
  onError: (error: string) => void;
  isProcessingContent: boolean;
}

interface ProgressEvent {
  progress: number;
  time: number;
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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<DebugInfo[]>([]);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addDebugInfo = (stage: string, details: string) => {
    setDebugInfo(prev => [...prev, {
      stage,
      details,
      timestamp: new Date().toISOString()
    }]);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      addDebugInfo('File Selection', `Selected file: ${file.name}, Size: ${(file.size / (1024 * 1024)).toFixed(2)}MB, Type: ${file.type}`);
      
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = `Video file size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
        setError(errorMsg);
        addDebugInfo('Error', errorMsg);
        return;
      }
      setVideoFile(file);
      extractAudio(file);
    }
  };

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const extractAudio = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setProgress('Initializing FFmpeg...');
    addDebugInfo('FFmpeg Init', 'Starting FFmpeg initialization');

    try {
      // Initialize FFmpeg
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      
      addDebugInfo('FFmpeg Load', 'Loading FFmpeg WASM modules');
      // Load FFmpeg
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      addDebugInfo('FFmpeg Load', 'FFmpeg WASM modules loaded successfully');

      // Log progress
      ffmpeg.on('progress', (event: ProgressEvent) => {
        const progressMsg = `Converting video: ${(event.progress * 100).toFixed(0)}%`;
        setProgress(progressMsg);
        addDebugInfo('Progress', progressMsg);
      });

      // Log any FFmpeg messages
      ffmpeg.on('log', ({ message }) => {
        addDebugInfo('FFmpeg Log', message);
      });

      setProgress('Loading video file...');
      addDebugInfo('File Processing', 'Writing video file to FFmpeg virtual filesystem');
      // Write the video file to FFmpeg's virtual file system
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));

      setProgress('Extracting audio...');
      addDebugInfo('Audio Extraction', 'Starting audio extraction process');
      // Extract audio from the video with more detailed logging
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vn', // Disable video
        '-acodec', 'libmp3lame',
        '-ab', '128k',
        '-ar', '44100',
        '-y', // Overwrite output file if exists
        'output.mp3'
      ]);

      addDebugInfo('Audio Extraction', 'Reading extracted audio file');
      // Read the extracted audio file
      const audioData = await ffmpeg.readFile('output.mp3');
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      setAudioFile(audioBlob);
      addDebugInfo('Audio Extraction', `Audio extracted successfully. Size: ${(audioBlob.size / (1024 * 1024)).toFixed(2)}MB`);

      // Clean up FFmpeg virtual file system
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('output.mp3');
      addDebugInfo('Cleanup', 'Cleaned up temporary files');

      // Start transcription
      await transcribeAudio(audioBlob);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract audio from the video';
      setError(errorMessage);
      onError(errorMessage);
      addDebugInfo('Error', `Audio extraction failed: ${errorMessage}`);
      if (err instanceof Error && err.stack) {
        addDebugInfo('Error Stack', err.stack);
      }
    } finally {
      setIsLoading(false);
      setProgress('');
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
      if (err instanceof Error && err.stack) {
        addDebugInfo('Error Stack', err.stack);
      }
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