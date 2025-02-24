import React from 'react';
import { Reference } from '../types/reference';

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
      {/* ... existing content ... */}
    </div>
  );
}; 