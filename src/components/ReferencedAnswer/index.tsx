import React from 'react';
import { FileText, Link, Presentation, Youtube as YoutubeIcon } from 'lucide-react';
import { CombinedContent, ContentSource, ContentLocation } from '../../types';
import { useHighlight } from '../../contexts/HighlightContext';
import ReferenceLink from '../ReferenceLink';
import { Reference } from '../../types/reference';

interface ReferencedAnswerProps {
  answer: string;
  references: Reference[];
  onReferenceClick: (reference: Reference) => void;
}

const ReferencedAnswer: React.FC<ReferencedAnswerProps> = ({
  answer,
  references,
  onReferenceClick,
}) => {
  const { setHighlightedReference } = useHighlight();

  const handleReferenceClick = (reference: Reference) => {
    if (!reference.source.location) return;
    
    const combinedContent: CombinedContent = {
      text: reference.text,
      source: {
        type: reference.source.type,
        title: reference.source.title,
        location: reference.source.location
      }
    };
    setHighlightedReference(combinedContent);
    onReferenceClick(reference);
  };

  const renderContent = (text: string) => {
    console.log('Rendering content with text:', text);
    console.log('Available references:', references);

    // Split by reference markers and render
    const parts = text.split(/(__REF_MARKER_\d+__)/);
    
    return parts.map((part, index) => {
      const markerMatch = part.match(/^__REF_MARKER_(\d+)__$/);
      if (markerMatch) {
        const refIndex = parseInt(markerMatch[1]);
        const reference = references[refIndex];
        console.log('Rendering reference link for:', reference);
        if (reference) {
          return (
            <ReferenceLink
              key={index}
              reference={reference}
              onClick={handleReferenceClick}
            />
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
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

  // Helper function to format display text
  const formatDisplayText = (source: ContentSource) => {
    if (source.type === 'youtube') {
      const timestamp = source.location?.value?.toString() || '';
      let timeNum: number;
      
      if (timestamp.includes(':')) {
        const [minutes, seconds] = timestamp.split(':').map(Number);
        timeNum = (minutes * 60) + seconds;
      } else {
        timeNum = parseInt(timestamp, 10);
      }
      
      if (!isNaN(timeNum)) {
        const minutes = Math.floor(timeNum / 60);
        const seconds = timeNum % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      return timestamp;
    }
    
    switch (source.type) {
      case 'pdf':
        return `Page ${source.location?.value}`;
      case 'ppt':
      case 'pptx':
        return `Slide ${source.location?.value}`;
      case 'txt':
        return `Section ${source.location?.value}`;
      default:
        return source.location?.value?.toString() || '';
    }
  };

  return (
    <div className="whitespace-pre-wrap">
      {renderContent(answer)}
    </div>
  );
};

export default ReferencedAnswer; 