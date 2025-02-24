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
      // Create button for both formats
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
      formattedContent = formattedContent.replace(
        pattern,
        `<span class="inline-flex align-baseline" style="display: inline-flex; margin: 0 0.25rem;">${
          ReactDOMServer.renderToString(button)
        }</span>`
      );
    });

    return formattedContent;
  };

  // Create a container with click handler delegation
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.reference-link')) {
      const refIndex = target.closest('.reference-link')?.getAttribute('data-index');
      if (refIndex !== null && refIndex !== undefined) {
        const reference = references[parseInt(refIndex)];
        onReferenceClick(reference);
      }
    }
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