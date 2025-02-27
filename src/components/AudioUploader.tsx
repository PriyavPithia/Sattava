import React, { useState, ChangeEvent, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import axios from 'axios';

interface AudioUploaderProps {
  onTranscriptionComplete?: (transcription: string) => void;
}

const AudioUploader: React.FC<AudioUploaderProps> = ({ onTranscriptionComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Check file size (25MB limit)
      if (selectedFile.size > 25 * 1024 * 1024) {
        setError('File size must be less than 25MB');
        return;
      }
      
      // Check file type
      if (!selectedFile.type.startsWith('audio/')) {
        setError('Please upload an audio file');
        return;
      }
      
      setFile(selectedFile);
      handleSubmit(selectedFile);
    }
  };

  const handleSubmit = async (audioFile: File) => {
    setIsLoading(true);
    setError('');
    console.log('Starting audio transcription...');

    const formData = new FormData();
    formData.append('file', audioFile); // OpenAI expects 'file', not 'audio'
    formData.append('model', 'whisper-1'); // Specify the model

    try {
      console.log('Sending request to OpenAI Whisper API...');
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
            console.log(`Upload progress: ${percentCompleted}%`);
          },
        }
      );

      console.log('Transcription response:', response.data);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const newTranscription = response.data.text; // OpenAI returns 'text', not 'transcription'
      setTranscription(newTranscription);
      
      if (onTranscriptionComplete) {
        onTranscriptionComplete(newTranscription);
      }
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      let errorMessage = 'Failed to transcribe audio. Please try again.';
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          errorMessage = 'Could not connect to OpenAI. Please check your internet connection.';
        } else if (error.response?.status === 401) {
          errorMessage = 'Invalid API key. Please check your OpenAI API key configuration.';
        } else if (error.response?.status === 413) {
          errorMessage = 'File is too large. Maximum size is 25MB.';
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error.message || error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div 
        onClick={handleFileClick}
        className={`w-full flex flex-col items-center justify-center cursor-pointer ${
          isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
        }`}
      >
        {isLoading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="mt-2 text-sm text-gray-600">Transcribing audio...</p>
          </div>
        ) : (
          <>
            <Upload className="w-12 h-12 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-900">
              {file ? file.name : 'Click to upload audio file'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              MP3, WAV, M4A, or other audio files (max 25MB)
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {transcription && !isLoading && (
        <div className="mt-4 w-full">
          <h4 className="text-sm font-medium text-gray-700 mb-1">Preview:</h4>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
            {transcription.length > 150 
              ? transcription.substring(0, 150) + '...' 
              : transcription}
          </p>
        </div>
      )}
    </div>
  );
};

export default AudioUploader;