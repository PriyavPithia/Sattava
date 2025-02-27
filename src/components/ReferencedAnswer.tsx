import React from 'react';
import { Reference } from '../types/reference';
import ReferenceLink from './ReferenceLink';
import { useHighlight } from '../contexts/HighlightContext';

interface Props {
  answer: string;
  references: Reference[];
  onReferenceClick?: (reference: Reference) => void;
}

const ReferencedAnswer: React.FC<Props> = ({ answer, references, onReferenceClick }) => {
  const { setHighlightedReference } = useHighlight();

  const renderContent = () => {
    const parts = answer.split(/(__REF_MARKER_\d+__)/);
    return parts.map((part, index) => {
      const match = part.match(/^__REF_MARKER_(\d+)__$/);
      if (match) {
        const refIndex = parseInt(match[1]);
        const reference = references[refIndex];
        if (reference) {
          return (
            <ReferenceLink
              key={`ref-${index}`}
              reference={reference}
              onClick={() => {
                setHighlightedReference(reference);
                onReferenceClick?.(reference);
              }}
            />
          );
        }
      }
      return <span key={`text-${index}`}>{part}</span>;
    });
  };

  return (
    <div className="whitespace-pre-wrap">
      {renderContent()}
    </div>
  );
};

export default ReferencedAnswer; 