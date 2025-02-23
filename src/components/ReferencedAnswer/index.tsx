import React, { useEffect, useRef } from 'react';
import { FileText, Link, Presentation, Youtube as YoutubeIcon } from 'lucide-react';
import { CombinedContent, ContentReference } from '../types';
import { useHighlight } from '../../contexts/HighlightContext';
import ReferenceLink from '../ReferenceLink';
import { Reference } from '../../types/reference';
import { parseReferenceTag } from '../../utils/reference';

// Add ContentSource type definition locally since it's not in types
type ContentSource = {
  type: 'youtube' | 'pdf' | 'txt' | 'ppt' | 'pptx';
  title: string;
  location?: {
    type: string;
    value: string | number;
  };
};

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

  const renderContent = (text: string) => {
    console.log('Rendering content with text:', text);
    console.log('Available references:', references);

    // First, replace the reference tags with markers
    const processedText = text.replace(/\{\{ref:[^}]+\}\}/g, (match) => {
      console.log('Processing reference tag:', match);
      const reference = parseReferenceTag(match);
      if (reference) {
        console.log('Parsed reference:', reference);
        // Find matching reference in the references array
        const index = references.findIndex(ref => 
          ref.sourceId === reference.sourceId && 
          ref.sourceType === reference.sourceType &&
          ref.location.value.toString() === reference.location.value.toString()
        );
        console.log('Found reference index:', index);
        if (index !== -1) {
          return `__REF_MARKER_${index}__`;
        }
      }
      console.log('No matching reference found for tag:', match);
      return match;
    });

    console.log('Processed text with markers:', processedText);

    // Then split and render the content with reference links
    const parts = processedText.split(/(__REF_MARKER_\d+__)/);
    
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

  const handleReferenceClick = (ref: Reference) => {
    console.log('Reference clicked:', ref);
    
    const reference: CombinedContent = {
      text: ref.text,
      source: {
        type: ref.sourceType,
        title: ref.sourceTitle,
        location: {
          type: ref.location.type,
          value: ref.location.value
        }
      }
    };

    console.log('Created reference object:', reference);
    setHighlightedReference(reference);
    onReferenceClick(ref);
  };

  return (
    <div className="prose max-w-none">
      {renderContent(answer)}
    </div>
  );
};

export default ReferencedAnswer; 