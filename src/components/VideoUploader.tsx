import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';

interface VideoUploaderProps {
  onTranscriptionComplete?: (transcription: string) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onTranscriptionComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        setError('File size must be less than 100MB');
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('video/')) {
        setError('Please upload a video file');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('video', selectedFile);
    
    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('Conversion failed');
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // After getting the audio, send it to Whisper API for transcription
      if (onTranscriptionComplete) {
        const audioFormData = new FormData();
        audioFormData.append('audio', blob, 'converted.mp3');

        const transcriptionRes = await fetch('/api/whisper-transcription', {
          method: 'POST',
          body: audioFormData,
        });

        if (!transcriptionRes.ok) {
          throw new Error('Transcription failed');
        }

        const transcriptionData = await transcriptionRes.json();
        onTranscriptionComplete(transcriptionData.transcription);
      }
    } catch (error: any) {
      console.error(error);
      setError(error.message || 'Error converting video to audio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div 
        onClick={handleFileClick}
        className={`w-full flex flex-col items-center justify-center cursor-pointer ${
          loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
        }`}
      >
        {loading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="mt-2 text-sm text-gray-600">Converting video...</p>
          </div>
        ) : (
          <>
            <Upload className="w-12 h-12 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-900">
              {selectedFile ? selectedFile.name : 'Click to upload video file'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              MP4, AVI, MOV, or other video files (max 100MB)
            </p>
          </>
        )}
      </div>

      {selectedFile && !loading && !audioUrl && (
        <button
          onClick={handleSubmit}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Convert Video
        </button>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {audioUrl && !loading && (
        <div className="mt-4 w-full">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Preview:</h4>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}
    </div>
  );
};

export default VideoUploader; 