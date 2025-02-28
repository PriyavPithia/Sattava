import React, { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
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

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        setError('Video file size must be less than 100MB');
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

    try {
      // Initialize FFmpeg
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      
      // Load FFmpeg
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      // Log progress
      ffmpeg.on('progress', (event: ProgressEvent) => {
        setProgress(`Converting video: ${(event.progress * 100).toFixed(0)}%`);
      });

      setProgress('Loading video file...');
      // Write the video file to FFmpeg's virtual file system
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));

      setProgress('Extracting audio...');
      // Extract audio from the video
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vn', // Disable video
        '-acodec', 'libmp3lame',
        '-ab', '128k',
        '-ar', '44100',
        'output.mp3'
      ]);

      // Read the extracted audio file
      const audioData = await ffmpeg.readFile('output.mp3');
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      setAudioFile(audioBlob);

      // Clean up FFmpeg virtual file system
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('output.mp3');

      // Start transcription
      await transcribeAudio(audioBlob);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract audio from the video';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setProgress('Transcribing audio...');
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'output.mp3');
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.text) {
        onTranscriptionComplete(data.text);
      } else {
        throw new Error('No transcription text received');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setError(errorMessage);
      onError(errorMessage);
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
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
      <p className="mt-2 text-sm text-gray-500">
        Upload a video file (max 100MB) to automatically transcribe its content.
      </p>
    </div>
  );
};

export default VideoToText; 