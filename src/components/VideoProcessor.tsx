import React, { useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import axios from 'axios';
import { Loader2, Upload } from 'lucide-react';

interface VideoProcessorProps {
  onTranscriptionComplete: (transcription: string) => void;
  onError: (error: string) => void;
}

interface FFmpegProgress {
  ratio: number;
}

const VideoProcessor: React.FC<VideoProcessorProps> = ({ onTranscriptionComplete, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processVideo = async (file: File) => {
    setIsProcessing(true);
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

      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        setProgress(`Converting video: ${(progress * 100).toFixed(0)}%`);
      });

      // Write the video file to FFmpeg's file system
      setProgress('Loading video...');
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));

      // Extract audio from the video
      setProgress('Extracting audio...');
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

      // Create form data for the Whisper API
      setProgress('Transcribing audio...');
      const formData = new FormData();
      formData.append('audio', audioBlob, 'output.mp3');

      // Send to Whisper API
      const response = await axios.post('/api/whisper-transcription', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.transcription) {
        onTranscriptionComplete(response.data.transcription);
      } else {
        throw new Error('No transcription returned from server');
      }

      // Clean up FFmpeg files
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('output.mp3');

    } catch (error) {
      console.error('Error processing video:', error);
      onError(error instanceof Error ? error.message : 'Failed to process video');
    } finally {
      setIsProcessing(false);
      setProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      onError('Please select a video file');
      return;
    }

    await processVideo(file);
  };

  return (
    <div>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/*"
          className="hidden"
          disabled={isProcessing}
        />
        {isProcessing ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="mt-2 text-sm text-gray-600">{progress || 'Processing video...'}</p>
          </div>
        ) : (
          <div 
            className="flex flex-col items-center cursor-pointer"
            onClick={handleFileButtonClick}
          >
            <Upload className="w-12 h-12 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-900">Click to upload video</p>
            <p className="mt-1 text-xs text-gray-500">or drag and drop</p>
          </div>
        )}
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Upload video files (MP4, WebM, etc.) to extract text content.
      </p>
    </div>
  );
};

export default VideoProcessor; 