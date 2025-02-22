import React from 'react';
import StudyNotes from '../StudyNotes';
import QASection from '../QASection';
import TranscriptViewer from '../TranscriptViewer';
import PDFViewer from '../PDFViewer';
import EmptyState from '../EmptyState';
import PowerPointViewer from '../PowerPointViewer';
import { VideoItem, ExtractedContent } from '../types';

interface MainContentProps {
  selectedVideo: VideoItem | null;
  rawResponse: any;
  studyNotes: string;
  generatingNotes: boolean;
  loadingNotes: boolean;
  onGenerateNotes: () => void;
  messages: any[];
  question: string;
  askingQuestion: boolean;
  onQuestionChange: (value: string) => void;
  onAskQuestion: () => void;
  durationFilter: number;
  onDurationFilterChange: (value: number) => void;
  onSeek: (timestamp: number) => void;
  loadingTranscript: boolean;
  loading: boolean;
  extractedText: ExtractedContent[];
  groupTranscriptsByDuration: (transcripts: any[]) => any[];
  formatTime: (seconds: number) => string;
  calculateTotalDuration: (transcripts: any[]) => number;
  formatDurationLabel: (duration: number) => string;
  processMarkdown: (content: string) => string;
  onCreateProject: (name: string, description?: string) => Promise<void>;
}

const MainContent: React.FC<MainContentProps> = ({
  selectedVideo,
  rawResponse,
  studyNotes,
  generatingNotes,
  loadingNotes,
  onGenerateNotes,
  messages,
  question,
  askingQuestion,
  onQuestionChange,
  onAskQuestion,
  durationFilter,
  onDurationFilterChange,
  onSeek,
  loadingTranscript,
  loading,
  extractedText,
  groupTranscriptsByDuration,
  formatTime,
  calculateTotalDuration,
  formatDurationLabel,
  processMarkdown,
  onCreateProject
}) => {
  if (!selectedVideo) {
    return <EmptyState onCreateProject={onCreateProject} />;
  }

  console.log('Selected Video:', selectedVideo);
  console.log('Raw Response:', rawResponse);
  console.log('Extracted Text:', extractedText);

  return (
    <div className="flex-1 flex">
      {/* Chat Section */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Chat</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%]  rounded-lg p-3 ${
                message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}>
              {message.content}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <input
            type="text"
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder="Select a transcription to start chatting"
            className="w-full px-4 py-2 rounded-lg border border-gray-300"
          />
          <button
            onClick={onAskQuestion}
            disabled={askingQuestion || !question}
            className="w-full mt-2 px-4 py-2 bg-black text-white rounded-lg disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Transcription Content</h2>
          <select 
            value={durationFilter}
            onChange={(e) => onDurationFilterChange(Number(e.target.value))}
            className="px-3 py-1 border rounded-md"
          >
            <option value="0">No grouping</option>
            <option value="15">15 second chunks</option>
            <option value="30">30 second chunks</option>
            <option value="60">1 minute chunks</option>
          </select>
        </div>
        
        <div className="p-4">
          {selectedVideo ? (
            <div className="space-y-4">
              {/* Render content based on type */}
              {selectedVideo.type === 'youtube' && rawResponse?.transcripts && (
                <TranscriptViewer 
                  videoUrl={selectedVideo.url}
                  transcripts={Array.isArray(rawResponse?.transcripts) ? 
                    rawResponse.transcripts.filter(t => t && typeof t.start !== 'undefined') : 
                    []
                  }
                  durationFilter={durationFilter}
                  onDurationFilterChange={onDurationFilterChange}
                  onSeek={onSeek}
                  loadingTranscript={loadingTranscript}
                  groupTranscriptsByDuration={groupTranscriptsByDuration}
                  formatTime={formatTime}
                  calculateTotalDuration={calculateTotalDuration}
                  formatDurationLabel={formatDurationLabel}
                />
              )}
              {['pdf', 'txt', 'ppt', 'pptx'].includes(selectedVideo.type) && (
                <PDFViewer 
                  type={selectedVideo.type}
                  title={selectedVideo.title}
                  loading={loading}
                  extractedText={selectedVideo.extractedContent || extractedText || []}
                />
              )}
            </div>
          ) : (
            <p className="text-gray-500">Select a transcription to view its content</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainContent; 