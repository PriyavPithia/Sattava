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
    const location = highlightedReference.source.location;
    
    if (refType === type && location.type === 'chunk') {
      // Find the matching chunk
      const index = type === 'txt' 
        ? extractedText.findIndex(chunk => chunk.index === location.chunkIndex)
        : extractedText.findIndex(chunk => 
            chunk.pageNumber === location.pageNumber &&
            chunk.startOffset >= (location.startOffset || 0) &&
            chunk.endOffset <= (location.endOffset || chunk.endOffset || 0)
          );
      
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

    const location = highlightedReference.source.location;
    if (location.type !== 'chunk') return false;

    // For text files, compare chunk indices
    if (type === 'txt') {
      return chunk.index === location.chunkIndex;
    }
    
    // For PDF and other files, compare page numbers and check if within chunk range
    return chunk.pageNumber === location.pageNumber && 
           (chunk.startOffset >= (location.startOffset || 0) && 
            chunk.endOffset <= (location.endOffset || chunk.endOffset || 0));
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