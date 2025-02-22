import React from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { useHighlight } from '../../contexts/HighlightContext';
import ReferencedAnswer from '../ReferencedAnswer';
import { CombinedContent } from '../types';

interface QASectionProps {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    references?: CombinedContent[];
  }>;
  question: string;
  askingQuestion: boolean;
  onQuestionChange: (value: string) => void;
  onAskQuestion: () => void;
}

const QASection: React.FC<QASectionProps> = ({
  messages,
  question,
  askingQuestion,
  onQuestionChange,
  onAskQuestion,
}) => {
  const { setHighlightedReference } = useHighlight();

  const handleReferenceClick = (reference: CombinedContent) => {
    setHighlightedReference(reference);
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-red-600" />
          Ask Questions
        </h2>
      </div>
      <div className="space-y-4">
        <div className="flex flex-col h-[400px]">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="font-medium mb-2">
                    {message.role === 'user' ? 'You' : 'Assistant'}:
                  </div>
                  {message.role === 'assistant' && message.references ? (
                    <ReferencedAnswer
                      answer={message.content}
                      references={message.references}
                      onReferenceClick={handleReferenceClick}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {askingQuestion && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-red-600" />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder="Ask a question about the content..."
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onAskQuestion();
                }
              }}
            />
            <button
              onClick={onAskQuestion}
              disabled={askingQuestion || !question}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {askingQuestion ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QASection; 