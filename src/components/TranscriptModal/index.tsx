import React from 'react';
import { Clock, X } from 'lucide-react';

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  timestamp: number;
  text: string;
  formatTime: (seconds: number) => string;
}

const TranscriptModal: React.FC<TranscriptModalProps> = ({
  isOpen,
  onClose,
  timestamp,
  text,
  formatTime
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold">
              Transcript at {formatTime(timestamp)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-lg leading-relaxed text-gray-800">{text}</p>
        </div>
      </div>
    </div>
  );
};

export default TranscriptModal; 