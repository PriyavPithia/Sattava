import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Reference } from '../types/reference';
import ReferenceLink from './ReferenceLink';

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
  // Function to convert markdown to HTML while preserving reference markers
  const formatMarkdown = (text: string) => {
    return text
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-gray-900 mb-4">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-gray-800 mt-6 mb-3">$2</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-700">$1</strong>')
      .replace(/^- (.*$)/gm, '<li class="text-gray-700 mb-2">$1</li>')
      .split('\n')
      .map(line => line.startsWith('-') ? line : `<p class="text-gray-700 mb-3">${line}</p>`)
      .join('\n');
  };

  // Replace each reference marker with its corresponding button
  const replaceReferencesWithButtons = () => {
    let formattedContent = formatMarkdown(answer);
    
    references.forEach((ref, index) => {
      const marker = `__REF_MARKER_${index + 1}__`;
      formattedContent = formattedContent.replace(
        marker,
        `<span class="inline-flex align-baseline" style="display: inline-flex; margin: 0 0.25rem;">${
          ReactDOMServer.renderToString(
            <ReferenceLink
              key={index}
              reference={ref}
              onClick={() => onReferenceClick(ref)}
            />
          )
        }</span>`
      );
    });

    return formattedContent;
  };

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: replaceReferencesWithButtons() }}
    />
  );
};

export default ReferencedAnswer; 