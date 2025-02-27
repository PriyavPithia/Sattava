import React from 'react';
import { FileText, Link, Presentation, Youtube as YoutubeIcon } from 'lucide-react';
import { Reference } from '../../types/reference';

interface ReferenceLinkProps {
  reference: Reference;
  onClick: (reference: Reference) => void;
}

const ReferenceLink: React.FC<ReferenceLinkProps> = ({ reference, onClick }) => {
  const getSourceIcon = () => {
    switch (reference.source.type) {
      case 'youtube':
        return <YoutubeIcon className="w-4 h-4 text-red-600" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'ppt':
      case 'pptx':
        return <Presentation className="w-4 h-4 text-orange-600" />;
      case 'txt':
        return <FileText className="w-4 h-4 text-gray-600" />;
      default:
        return <Link className="w-4 h-4" />;
    }
  };

  const getDisplayText = () => {
    if (reference.source.type === 'youtube' && reference.source.location) {
      const value = reference.source.location.value;
      const seconds = typeof value === 'string' ? parseInt(value) : value;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    if (reference.source.location) {
      return `${reference.source.title} (${reference.source.location.value})`;
    }
    
    return reference.source.title;
  };

  return (
    <button
      onClick={() => onClick(reference)}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded hover:bg-gray-100 ml-1"
    >
      {getSourceIcon()}
      <span>{getDisplayText()}</span>
    </button>
  );
};

export default ReferenceLink; 