import React, { createContext, useContext, useState } from 'react';
import { CombinedContent } from '../components/types';

interface HighlightContextType {
  highlightedReference: CombinedContent | null;
  setHighlightedReference: (ref: CombinedContent | null) => void;
}

const HighlightContext = createContext<HighlightContextType | undefined>(undefined);

export const HighlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [highlightedReference, setHighlightedReference] = useState<CombinedContent | null>(null);

  return (
    <HighlightContext.Provider value={{ highlightedReference, setHighlightedReference }}>
      {children}
    </HighlightContext.Provider>
  );
};

export const useHighlight = () => {
  const context = useContext(HighlightContext);
  if (context === undefined) {
    throw new Error('useHighlight must be used within a HighlightProvider');
  }
  return context;
}; 