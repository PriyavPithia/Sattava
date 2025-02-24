import React from 'react';
import { FileText, Youtube, Clock, Presentation, FileType, BookText, FileSpreadsheet } from 'lucide-react';
import { Reference } from '../types/reference';

interface ReferenceLinkProps {
  reference: Reference;
  onClick: (reference: Reference) => void;
}

const ReferenceLink: React.FC<ReferenceLinkProps> = ({ reference, onClick }) => {
  const getFileIcon = () => {
    switch (reference.sourceType) {
      case 'pdf':
        return <BookText className="w-4 h-4" />;
      case 'ppt':
      case 'pptx':
        return <Presentation className="w-4 h-4" />;
      case 'txt':
        return <FileSpreadsheet className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getButtonStyle = () => {
    switch (reference.sourceType) {
      case 'youtube':
        return 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200';
      case 'pdf':
        return 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200';
      case 'ppt':
      case 'pptx':
        return 'bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-200';
      case 'txt':
        return 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200';
      default:
        return 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getLabel = () => {
    switch (reference.sourceType) {
      case 'pdf':
        return 'PDF';
      case 'ppt':
      case 'pptx':
        return 'Slides';
      case 'txt':
        return 'Notes';
      default:
        return '';
    }
  };

  const formatTimestamp = (value: string | number): string => {
    let seconds: number;
    
    // Handle MM:SS format
    if (typeof value === 'string' && value.includes(':')) {
      const [minutes, secs] = value.split(':').map(Number);
      if (!isNaN(minutes) && !isNaN(secs)) {
        seconds = (minutes * 60) + secs;
      } else {
        console.error('Invalid timestamp format:', value);
        return '0:00';
      }
    } 
    // Handle raw seconds
    else {
      seconds = typeof value === 'string' ? parseInt(value) : value;
      if (isNaN(seconds)) {
        console.error('Invalid timestamp value:', value);
        return '0:00';
      }
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <button
      onClick={() => onClick(reference)}
      className={`reference-link inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${getButtonStyle()}`}
      data-index={reference.index}
    >
      {reference.sourceType === 'youtube' ? (
        <>
          <Youtube className="w-4 h-4" />
          <span>{formatTimestamp(reference.location.value)}</span>
        </>
      ) : (
        <>
          {getFileIcon()}
          <span>
            {reference.sourceType.toUpperCase()} • {reference.sourceTitle.split('/').pop()?.split('.')[0]} • Page {reference.location.value}
          </span>
        </>
      )}
    </button>
  );
};

export default ReferenceLink; 