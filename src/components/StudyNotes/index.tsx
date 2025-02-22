import React from 'react';
import { BookOpen, Brain, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

interface StudyNotesProps {
  studyNotes: string;
  generatingNotes: boolean;
  loadingNotes: boolean;
  onGenerateNotes: () => void;
  hasTranscripts: boolean;
  processMarkdown: (content: string) => string;
}

const StudyNotes: React.FC<StudyNotesProps> = ({
  studyNotes,
  generatingNotes,
  loadingNotes,
  onGenerateNotes,
  hasTranscripts,
  processMarkdown
}) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-red-600" />
          Study Notes
        </h2>
        <button
          onClick={onGenerateNotes}
          disabled={generatingNotes || !hasTranscripts}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generatingNotes ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" />
              Generate Notes
            </>
          )}
        </button>
      </div>
      <div className="bg-gray-50 rounded-lg p-6 min-h-[300px] border border-gray-100">
        {loadingNotes ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-4" />
              <p className="text-gray-600">Generating study notes...</p>
            </div>
          </div>
        ) : studyNotes ? (
          <div 
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: processMarkdown(studyNotes)
            }}
          />
        ) : (
          <div className="text-gray-500 text-center py-8">
            Click "Generate Notes" to create study notes from the content
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyNotes; 