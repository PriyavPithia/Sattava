import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Reference, ContentLocation } from '../types/reference';
import ReferenceLink from './ReferenceLink';
import { useHighlight } from '../contexts/HighlightContext';
import { CombinedContent } from '../components/types';

interface ReferencedAnswerProps {
  answer: string;
  references: Reference[];
  onReferenceClick: (reference: Reference) => void;
  className?: string;
}

const ReferencedAnswer: React.FC<ReferencedAnswerProps> = ({ 
  answer, 
  references, 
  onReferenceClick,
  className = ''
}) => {
  const { setHighlightedReference } = useHighlight();

  // Function to convert markdown to HTML while preserving reference markers
  const formatMarkdown = (text: string) => {
    let formatted = text;
    
    // Handle headings
    formatted = formatted.replace(/^# (.*)$/gm, (_, content) => 
      `<h1 class="text-2xl font-bold text-gray-900 mb-4">${content}</h1>`
    );
    formatted = formatted.replace(/^## (.*)$/gm, (_, content) => 
      `<h2 class="text-xl font-semibold text-gray-800 mt-6 mb-3">${content}</h2>`
    );
    
    // Handle other formatting
    formatted = formatted
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-700">$1</strong>')
      .replace(/^- (.*)$/gm, '<li class="text-gray-700 mb-2">$1</li>');
    
    // Handle paragraphs
    formatted = formatted
      .split('\n')
      .map(line => line.startsWith('-') ? line : `<p class="text-gray-700 mb-3">${line}</p>`)
      .join('\n');
    
    return formatted;
  };

  // Create a map of reference buttons
  const createReferenceButtons = () => {
    const buttons: { [key: string]: JSX.Element } = {};
    references.forEach((ref, index) => {
      const referenceWithIndex = { ...ref, index };
      buttons[`__REF_MARKER_${index}__`] = (
        <ReferenceLink
          key={index}
          reference={referenceWithIndex}
          onClick={onReferenceClick}
        />
      );
    });
    return buttons;
  };

  // Replace reference patterns with buttons
  const replaceReferencesWithButtons = () => {
    let formattedContent = formatMarkdown(answer);
    const buttons = createReferenceButtons();
    
    // Replace all reference patterns with their corresponding buttons
    Object.entries(buttons).forEach(([pattern, button]) => {
      const ref = button.props.reference;
      const isYoutube = ref.sourceType === 'youtube';
      const locationValue = isYoutube ? formatTimestamp(ref.location.value) : ref.location.value;
      
      formattedContent = formattedContent.replace(
        pattern,
        `<button 
          class="reference-link inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
            isYoutube ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200' : 
            'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'
          }"
          data-index="${ref.index}"
          data-source-type="${ref.sourceType}"
          data-source-title="${ref.sourceTitle}"
          data-location-type="${ref.location.type}"
          data-location-value="${ref.location.value}"
          data-source-id="${ref.sourceId}"
          data-text="${ref.text}"
        >${
          isYoutube 
            ? `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>`
            : ''
          }${
            isYoutube
              ? `<span>${locationValue}</span>`
              : `<span>${ref.sourceType.toUpperCase()} • ${ref.sourceTitle} • ${locationValue}</span>`
          }</button>`
      );
    });

    return formattedContent;
  };

  // Create a container with click handler delegation
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('.reference-link');
    if (button) {
      const locationType = button.getAttribute('data-location-type');
      // Only proceed if location type is valid for Reference type
      if (locationType === 'timestamp' || locationType === 'page') {
        const locationValue = button.getAttribute('data-location-value') || '';
        // Convert to number if it's a timestamp
        const parsedValue = locationType === 'timestamp' ? 
          parseInt(locationValue) : 
          locationValue;

        const reference: Reference = {
          sourceId: button.getAttribute('data-source-id') || '',
          sourceType: button.getAttribute('data-source-type') as Reference['sourceType'],
          sourceTitle: button.getAttribute('data-source-title') || '',
          location: {
            type: locationType as ContentLocation['type'],
            value: parsedValue
          },
          index: parseInt(button.getAttribute('data-index') || '0'),
          text: button.getAttribute('data-text') || ''
        };

        // Create and set the highlighted reference with string location
        const highlightedRef: CombinedContent = {
          text: reference.text,
          source: {
            type: reference.sourceType,
            title: reference.sourceTitle,
            location: locationType === 'timestamp' ? 
              formatTimestamp(reference.location.value as number) :
              reference.location.value.toString()
          }
        };
        
        // Set the highlighted reference first
        setHighlightedReference(highlightedRef);
        
        // Then call the click handler
        onReferenceClick(reference);
      }
    }
  };

  // Helper function to format timestamp
  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={className}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: replaceReferencesWithButtons() }}
    />
  );
};

export default ReferencedAnswer; 