import { useState } from 'react';
import { TranscriptResponse } from '../types/embedding';
import { generateStudyNotes } from '../utils/ai';

export const useStudyNotes = () => {
  const [studyNotes, setStudyNotes] = useState<string>('');
  const [generatingNotes, setGeneratingNotes] = useState<boolean>(false);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);

  const handleGenerateStudyNotes = async (rawResponse: TranscriptResponse | null) => {
    if (!rawResponse?.transcripts) return;
    
    setGeneratingNotes(true);
    setLoadingNotes(true);
    const contentText = rawResponse.transcripts
      .map(segment => segment.text)
      .join(' ');

    try {
      const notes = await generateStudyNotes(contentText);
      setStudyNotes(notes);
    } catch (error) {
      console.error('Error generating notes:', error);
      setStudyNotes('Failed to generate study notes. Please try again.');
    } finally {
      setGeneratingNotes(false);
      setLoadingNotes(false);
    }
  };

  return {
    studyNotes,
    setStudyNotes,
    generatingNotes,
    loadingNotes,
    handleGenerateStudyNotes
  };
}; 