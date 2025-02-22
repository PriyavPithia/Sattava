import React, { useRef, useEffect } from 'react';
import { FileText, Loader2, Presentation } from 'lucide-react';
import { useHighlight } from '../../contexts/HighlightContext';
import { ExtractedContent } from '../types';

interface PowerPointViewerProps {
  type: 'ppt' | 'pptx';
  title: string;
  loading: boolean;
  extractedText: ExtractedContent[];
  onTextExtracted?: (text: ExtractedContent[]) => void;
}

const PowerPointViewer: React.FC<PowerPointViewerProps> = ({
  type,
  title,
  loading,
  extractedText,
  onTextExtracted
}) => {
  const { highlightedReference } = useHighlight();
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (highlightedReference && (highlightedReference.source.type === 'ppt' || highlightedReference.source.type === 'pptx')) {
      const slideNumber = parseInt(highlightedReference.source.location?.replace('Slide ', '') || '0');
      const index = extractedText.findIndex(chunk => chunk.pageNumber === slideNumber);
      
      if (index !== -1 && slideRefs.current[index]) {
        slideRefs.current[index]?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [highlightedReference, extractedText]);

  const isHighlighted = (chunk: ExtractedContent) => {
    if (!highlightedReference || (highlightedReference.source.type !== 'ppt' && highlightedReference.source.type !== 'pptx')) {
      return false;
    }
    
    const refSlide = parseInt(highlightedReference.source.location?.replace('Slide ', '') || '0');
    return chunk.pageNumber === refSlide && highlightedReference.text === chunk.text;
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Presentation className="w-5 h-5 text-blue-600" />
            PowerPoint Content
          </h2>
          <div className="text-sm text-gray-500">
            {type.toUpperCase()} Presentation: {title}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 max-h-[600px] overflow-y-auto border border-gray-100">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Extracting presentation content...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {extractedText.map((chunk, index) => (
                <div 
                  key={index}
                  ref={el => slideRefs.current[index] = el}
                  className={`p-4 rounded-lg border transition-colors
                    ${isHighlighted(chunk) ? 'bg-yellow-100 border-yellow-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-2 text-blue-600 mb-2 text-sm font-medium">
                    <Presentation className="w-4 h-4" />
                    Slide {chunk.pageNumber}
                  </div>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {chunk.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PowerPointViewer; 