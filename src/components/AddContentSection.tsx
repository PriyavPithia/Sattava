import React, { useRef } from 'react';
import { Upload, Youtube, FileText, Paperclip } from 'lucide-react';

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
  addVideoMethod: string;
  setAddVideoMethod: (method: string) => void;
  url: string;
  setUrl: (url: string) => void;
  onAddVideo: () => void;
  onTranscriptGenerated: (transcript: any) => void;
  onError: (error: string) => void;
  onFileSelect: (file: File) => void;
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
      onFileSelect(files[0]);
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
          onClick={() => setAddVideoMethod('pdf')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
            addVideoMethod === 'pdf' 
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>PDF</span>
        </button>
        <button
          onClick={() => setAddVideoMethod('file')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
            addVideoMethod === 'file' 
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Paperclip className="w-5 h-5" />
          <span>Other File</span>
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

        {/* PDF Mode */}
        {addVideoMethod === 'pdf' && (
          <div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf"
                className="hidden"
                disabled={isProcessingContent}
              />
              {isProcessingContent ? (
                <div className="flex flex-col items-center">
                  <Spinner className="w-8 h-8 text-blue-500" />
                  <p className="mt-2 text-sm text-gray-600">Processing PDF...</p>
                </div>
              ) : (
                <div 
                  className="flex flex-col items-center cursor-pointer"
                  onClick={handleFileButtonClick}
                >
                  <Upload className="w-12 h-12 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-900">Click to upload PDF</p>
                  <p className="mt-1 text-xs text-gray-500">or drag and drop</p>
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Upload a PDF file to extract and process its text content.
            </p>
          </div>
        )}

        {/* Other File Mode */}
        {addVideoMethod === 'file' && (
          <div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt,.md,.doc,.docx"
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
              Upload text files (.txt), markdown (.md), or Word documents (.doc, .docx).
            </p>
          </div>
        )}
      </div>

      {/* Helpful Instructions */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Tips</h3>
        <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc pl-5">
          <li>Content will be processed and added to the selected knowledgebase</li>
          <li>You can add multiple items to the same knowledgebase</li>
          <li>Large files and long videos may take longer to process</li>
          <li>Supported formats: YouTube videos, PDFs, text files, markdown, and Word documents</li>
        </ul>
      </div>
    </div>
  );
};

export default AddContentSection; 