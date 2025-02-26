import React, { useRef, useState } from 'react';
import { Loader2, Upload, Youtube, FileText, Mic, Type } from 'lucide-react';

interface ContentAdditionProps {
  addVideoMethod: 'youtube' | 'files' | 'speech' | 'text';
  setAddVideoMethod: (method: 'youtube' | 'files' | 'speech' | 'text') => void;
  url: string;
  setUrl: (url: string) => void;
  onAddVideo: () => void;
  onTranscriptGenerated: (transcript: any) => void;
  onError: (error: string) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTextSubmit?: (text: string) => void;
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
  onTextSubmit,
  isProcessingContent
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textInput, setTextInput] = useState<string>('');

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleTextSubmit = () => {
    if (onTextSubmit && textInput.trim()) {
      onTextSubmit(textInput);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Add to Knowledge Base</h1>
      
      <div className="space-y-6">
        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 mb-6">
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
            onClick={() => setAddVideoMethod('files')}
            className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
              addVideoMethod === 'files' 
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Upload Files</span>
          </button>
          <button
            onClick={() => setAddVideoMethod('speech')}
            className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
              addVideoMethod === 'speech' 
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Mic className="w-5 h-5" />
            <span>Speech to Text</span>
          </button>
          <button
            onClick={() => setAddVideoMethod('text')}
            className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
              addVideoMethod === 'text' 
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Type className="w-5 h-5" />
            <span>Input Text</span>
          </button>
        </div>

        {/* YouTube Tab */}
        {addVideoMethod === 'youtube' && (
          <div>
            <h2 className="text-sm font-medium mb-2">YouTube URL</h2>
            <div className="flex">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 border border-gray-300 rounded-l px-4 py-2"
              />
              <button
                onClick={onAddVideo}
                disabled={isProcessingContent}
                className="px-4 py-2 bg-blue-600 text-white rounded-r"
              >
                Process
              </button>
            </div>
          </div>
        )}

        {/* Files Tab */}
        {addVideoMethod === 'files' && (
          <div>
            <h2 className="text-sm font-medium mb-2">Upload File (PDF, Text, PowerPoint)</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf,.txt,.ppt,.pptx,.doc,.docx"
                onChange={onFileSelect}
                className="hidden"
                ref={fileInputRef}
              />
              {isProcessingContent ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="mt-2 text-sm text-gray-600">Processing file...</p>
                </div>
              ) : (
                <div 
                  className="flex flex-col items-center cursor-pointer"
                  onClick={handleFileButtonClick}
                >
                  <Upload className="w-12 h-12 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-900">Click to upload files</p>
                  <p className="mt-1 text-xs text-gray-500">or drag and drop</p>
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Upload PDF, text files (.txt), PowerPoint (.ppt, .pptx), or Word documents (.doc, .docx).
            </p>
          </div>
        )}

        {/* Speech to Text Tab */}
        {addVideoMethod === 'speech' && (
          <div>
            <h2 className="text-sm font-medium mb-2">Speech to Text</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              {isProcessingContent ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="mt-2 text-sm text-gray-600">Processing audio...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <button
                    className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors"
                  >
                    <Mic className="w-10 h-10 text-blue-500" />
                  </button>
                  <p className="mt-4 text-sm font-medium text-gray-900">Click to start recording</p>
                  <p className="mt-1 text-xs text-gray-500">or upload an audio file</p>
                  <input
                    type="file"
                    accept="audio/*"
                    className="mt-4 text-sm"
                  />
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Record speech or upload an audio file to convert to text.
            </p>
          </div>
        )}

        {/* Input Text Tab */}
        {addVideoMethod === 'text' && (
          <div>
            <h2 className="text-sm font-medium mb-2">Enter Text</h2>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter or paste your text here..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-40"
              disabled={isProcessingContent}
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textInput.trim() || isProcessingContent}
              className={`mt-4 px-4 py-2 rounded flex items-center justify-center ${
                !textInput.trim() || isProcessingContent
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isProcessingContent ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : null}
              <span>Add to Knowledge Base</span>
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Directly enter or paste text to add to your knowledge base.
            </p>
          </div>
        )}
      </div>

      {isProcessingContent && addVideoMethod !== 'files' && addVideoMethod !== 'speech' && addVideoMethod !== 'text' && (
        <div className="mt-4 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Processing content...</p>
        </div>
      )}
    </div>
  );
};

export default ContentAddition; 