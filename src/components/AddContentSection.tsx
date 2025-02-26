import React, { useRef } from 'react';
import { Upload, Youtube, FileText, Paperclip } from 'lucide-react';
import YoutubeClient from './YoutubeClient';

interface SpinnerProps {
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className = "w-5 h-5" }) => (
  <div className={`animate-spin ${className}`}>
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
);

interface AddContentSectionProps {
  addVideoMethod: 'youtube' | 'youtube-client' | 'file-upload';
  setAddVideoMethod: (method: 'youtube' | 'youtube-client' | 'file-upload') => void;
  url: string;
  setUrl: (url: string) => void;
  onAddVideo: () => void;
  onTranscriptGenerated: (transcript: any) => void;
  onError: (error: string) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessingContent: boolean;
}

const AddContentSection: React.FC<AddContentSectionProps> = ({
  addVideoMethod,
  setAddVideoMethod,
  url,
  setUrl,
  onAddVideo,
  onFileSelect,
  isProcessingContent,
  onTranscriptGenerated,
  onError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(e);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Content Type Selector */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setAddVideoMethod('youtube')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
            addVideoMethod === 'youtube' 
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Youtube className="w-5 h-5" />
          <span>YouTube</span>
        </button>
        <button
          onClick={() => setAddVideoMethod('youtube-client')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
            addVideoMethod === 'youtube-client' 
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Youtube className="w-5 h-5" />
          <span>YouTube Client</span>
        </button>
        <button
          onClick={() => setAddVideoMethod('file-upload')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
            addVideoMethod === 'file-upload' 
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>File Upload</span>
        </button>
      </div>

      {/* Input Area */}
      <div className="p-6">
        {/* YouTube Mode */}
        {addVideoMethod === 'youtube' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter YouTube URL
            </label>
            <div className="flex">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 border border-gray-300 rounded-l px-4 py-2"
                disabled={isProcessingContent}
              />
              <button
                onClick={onAddVideo}
                disabled={!url || isProcessingContent}
                className={`px-4 py-2 rounded-r flex items-center justify-center ${
                  !url || isProcessingContent
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isProcessingContent ? (
                  <Spinner className="w-5 h-5" />
                ) : (
                  <span>Process</span>
                )}
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Paste a YouTube URL to transcribe the video and add it to your knowledgebase.
            </p>
          </div>
        )}

        {/* YouTube Client Mode */}
        {addVideoMethod === 'youtube-client' && (
          <div>
            <YoutubeClient
              url={url}
              setUrl={setUrl}
              onTranscriptGenerated={onTranscriptGenerated}
              onError={onError}
              isProcessingContent={isProcessingContent}
            />
            <p className="mt-2 text-sm text-gray-500">
              This uses the youtube-transcript package to fetch transcripts directly from YouTube.
            </p>
          </div>
        )}

        {/* File Upload Mode (Combined PDF and Other Files) */}
        {addVideoMethod === 'file-upload' && (
          <div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.txt,.md,.doc,.docx,.ppt,.pptx"
                className="hidden"
                disabled={isProcessingContent}
              />
              {isProcessingContent ? (
                <div className="flex flex-col items-center">
                  <Spinner className="w-8 h-8 text-blue-500" />
                  <p className="mt-2 text-sm text-gray-600">Processing file...</p>
                </div>
              ) : (
                <div 
                  className="flex flex-col items-center cursor-pointer"
                  onClick={handleFileButtonClick}
                >
                  <Upload className="w-12 h-12 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-900">Click to upload file</p>
                  <p className="mt-1 text-xs text-gray-500">or drag and drop</p>
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Upload PDF files (.pdf), text files (.txt), markdown (.md), Word documents (.doc, .docx), or PowerPoint presentations (.ppt, .pptx).
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddContentSection; 