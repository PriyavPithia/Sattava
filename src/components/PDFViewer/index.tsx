import React, { useRef, useEffect } from 'react';
import { FileText, Loader2, Clock } from 'lucide-react';
import { ExtractedContent } from '../../types';
import { useHighlight } from '../../contexts/HighlightContext';
import { CombinedContent } from '../types';

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
    if (!highlightedReference?.source?.type || !highlightedReference.source.location) {
      return;
    }
    
    try {
      const refType = highlightedReference.source.type;
      const locationStr = highlightedReference.source.location;
      console.log('DEBUG: Handling reference:', { refType, locationStr, type });

      if (refType === type) {
        let targetNumber: number;
        
        // Convert location string to number
        targetNumber = parseInt(locationStr, 10);
        if (isNaN(targetNumber)) {
          console.error('Invalid reference value:', locationStr);
          return;
        }

        console.log('DEBUG: Looking for page/section:', targetNumber);

        // Find the matching content index
        const index = type === 'txt' 
          ? extractedText.findIndex(chunk => (chunk.index || 0) + 1 === targetNumber)
          : extractedText.findIndex(chunk => chunk.pageNumber === targetNumber);
        
        console.log('DEBUG: Found index:', index);
        
        if (index === -1) {
          console.log('DEBUG: No matching content found');
          return;
        }

        // Get the elements
        const container = containerRef.current;
        const element = contentRefs.current[index];
        
        if (!container || !element) {
          console.log('DEBUG: Container or element not found');
          return;
        }

        // Scroll handling with requestAnimationFrame for smoother performance
        requestAnimationFrame(() => {
          try {
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
              if (element) {
                element.style.backgroundColor = '';
              }
            }, 3000);
          } catch (error) {
            console.error('Error during scroll/highlight:', error);
          }
        });
      }
    } catch (error) {
      console.error('Error handling reference:', error);
    }
  }, [highlightedReference, type, extractedText]);

  const isHighlighted = (chunk: ExtractedContent): boolean => {
    try {
      if (!highlightedReference?.source?.type || !highlightedReference.source.location) {
        return false;
      }
      
      const refType = highlightedReference.source.type;
      if (refType !== type) {
        return false;
      }

      const locationStr = highlightedReference.source.location;
      let targetNumber: number;

      // Convert location string to number
      targetNumber = parseInt(locationStr, 10);
      if (isNaN(targetNumber)) {
        return false;
      }

      if (type === 'txt') {
        // For text files, compare section numbers (1-based)
        return (chunk.index || 0) + 1 === targetNumber;
      } else {
        // For PDF and other files, compare page numbers directly
        return chunk.pageNumber === targetNumber;
      }
    } catch (error) {
      console.error('Error in isHighlighted:', error);
      return false;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading content...</p>
        </div>
      </div>
    );
  }

  if (!extractedText || extractedText.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No content available</p>
        </div>
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
              className={`p-4 rounded-lg border border-gray-200 transition-colors ${
                isHighlighted(content) ? 'bg-yellow-100' : ''
              }`}
            >
              <div className="text-sm text-gray-600 mb-2">
                {type === 'txt' ? (
                  <span>Section {(content.index || 0) + 1}</span>
                ) : (
                  <span>Page {content.pageNumber}</span>
                )}
              </div>
              <div className="text-gray-800 whitespace-pre-wrap">
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