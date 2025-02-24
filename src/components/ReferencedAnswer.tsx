import React from 'react';
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
  return (
    <div className={className}>
      <div className="whitespace-pre-wrap mb-2">{answer}</div>
      {references.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {references.map((reference, index) => (
            <ReferenceLink
              key={index}
              reference={reference}
              onClick={onReferenceClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReferencedAnswer; 