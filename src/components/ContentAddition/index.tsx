import React from 'react';
import { Loader2, Upload } from 'lucide-react';
import VideoUploader from '../VideoUploader';

interface ContentAdditionProps {
  addVideoMethod: 'youtube' | 'upload' | 'file';
  setAddVideoMethod: (method: 'youtube' | 'upload' | 'file') => void;
  url: string;
  setUrl: (url: string) => void;
  onAddVideo: () => void;
  onTranscriptGenerated: (transcript: any) => void;
  onError: (error: string) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessingContent: boolean;
}

const ContentAddition: React.FC<ContentAdditionProps> = ({
  addVideoMethod,
  setAddVideoMethod,
  url,
  setUrl,
  onAddVideo,
  onTranscriptGenerated,
  onError,
  onFileSelect,
  isProcessingContent
}) => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Add to Knowledge Base</h1>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium mb-2">Upload File (PDF, Text, PowerPoint)</h2>
          <div className="border border-gray-300 rounded-lg p-2">
            <input
              type="file"
              accept=".pdf,.txt,.ppt,.pptx"
              onChange={onFileSelect}
              className="w-full text-sm"
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium mb-2">YouTube URL</h2>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <button
          onClick={onAddVideo}
          disabled={isProcessingContent}
          className="w-full flex items-center justify-center px-4 py-2 bg-black text-white rounded-lg disabled:opacity-50"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </button>
      </div>

      {isProcessingContent && (
        <div className="mt-4 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Processing content...</p>
        </div>
      )}
    </div>
  );
};

export default ContentAddition; 