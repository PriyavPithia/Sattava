import React, { useRef, useEffect } from 'react';
import { FileText, Loader2, Clock } from 'lucide-react';
import { ExtractedContent } from '../types';
import { useHighlight } from '../../contexts/HighlightContext';

interface PDFViewerProps {
  type: string;
  title: string;
  loading: boolean;
  extractedText: ExtractedContent[];
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  type,
  title,
  loading,
  extractedText
}) => {
  const { highlightedReference } = useHighlight();
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightedReference?.source?.type || !highlightedReference.source.location) return;
    
    const refType = highlightedReference.source.type;
    const refValue = highlightedReference.source.location.value;
    console.log('Handling reference:', { refType, refValue, type });

    if (refType === type) {
      let targetNumber = typeof refValue === 'string' ? parseInt(refValue) : refValue;
      console.log('Looking for page/section:', targetNumber);

      const index = type === 'txt' 
        ? extractedText.findIndex(chunk => chunk.index === targetNumber)
        : extractedText.findIndex(chunk => chunk.pageNumber === targetNumber);
      
      console.log('Found index:', index);
      
      if (index !== -1 && contentRefs.current[index] && containerRef.current) {
        const container = containerRef.current;
        const element = contentRefs.current[index];
        
        // Calculate scroll position to center the element
        const containerHeight = container.clientHeight;
        const elementTop = element.offsetTop;
        const elementHeight = element.clientHeight;
        const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
        
        // Scroll to the element
        container.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });

        // Add highlight animation
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = '#fef3c7'; // yellow-100
        
        // Remove highlight after animation
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 3000);
      }
    }
  }, [highlightedReference, type, extractedText]);

  const isHighlighted = (chunk: ExtractedContent) => {
    if (!highlightedReference?.source?.type || !highlightedReference.source.location) return false;
    
    const refType = highlightedReference.source.type;
    if (refType !== type) return false;

    if (type === 'txt') {
      // For text files, compare section numbers (1-based)
      const sectionNumber = typeof highlightedReference.source.location.value === 'number' 
        ? highlightedReference.source.location.value 
        : parseInt(highlightedReference.source.location.value.toString(), 10);
      
      return (chunk.index || 0) + 1 === sectionNumber;
    } else {
      // For PDF and other files, compare page numbers directly
      const pageNumber = typeof highlightedReference.source.location.value === 'number'
        ? highlightedReference.source.location.value
        : parseInt(highlightedReference.source.location.value.toString(), 10);

      return chunk.pageNumber === pageNumber;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto p-4" ref={containerRef}>
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!extractedText || extractedText.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No content available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4" ref={containerRef}>
        <div className="space-y-4">
          {extractedText.map((content, index) => (
            <div
              key={index}
              ref={el => contentRefs.current[index] = el}
              className="p-4 rounded-lg border border-gray-200 transition-colors"
            >
              {type === 'txt' ? (
                <div className={`text-sm text-gray-600 mb-2 ${isHighlighted(content) ? 'bg-yellow-100' : ''}`}>
                  Section {(content.index || 0) + 1}
                </div>
              ) : (
                <div className={`text-sm text-gray-600 mb-2 ${isHighlighted(content) ? 'bg-yellow-100' : ''}`}>
                  Page {content.pageNumber}
                </div>
              )}
              <div className={`text-gray-800 whitespace-pre-wrap ${isHighlighted(content) ? 'bg-yellow-100' : ''}`}>
                {content.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer; 