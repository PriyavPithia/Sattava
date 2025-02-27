export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptGroup {
  startTime: number;
  endTime: number;
  text: string;
}

export interface CurrentGroup {
  startTime: number;
  endTime: number;
  texts: string[];
}

export interface CombinedContent {
  text: string;
  source: {
    type: 'youtube' | 'pdf' | 'txt' | 'ppt' | 'pptx' | 'speech';
    title: string;
    location?: string;
  };
} 