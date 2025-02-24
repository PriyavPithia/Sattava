import React from 'react';
import { TranscriptResponse } from '../types/embedding';

interface ContentAdditionProps {
  url: string;
  setUrl: (url: string) => void;
  onAddVideo: (url: string) => Promise<void>;
  onTranscriptGenerated: (transcript: TranscriptResponse) => void;
  onError: (error: string) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessingContent: boolean;
} 