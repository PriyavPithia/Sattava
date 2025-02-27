export type ContentSourceType = 'youtube' | 'pdf' | 'txt' | 'ppt' | 'pptx' | 'speech';

export type ContentLocation = {
  type: 'timestamp' | 'page' | 'section' | 'slide';
  value: number;
};

export type ContentSource = {
  type: ContentSourceType;
  title: string;
  location: ContentLocation;
};

export type CombinedContent = {
  text: string;
  source: ContentSource;
};

export type AddVideoMethod = 'youtube' | 'youtube_transcript' | 'files' | 'speech' | 'text' | 'video_upload';

export interface VideoItem {
  id: string;
  url: string;
  title: string;
  isEditing?: boolean;
  type: 'youtube' | 'local' | 'pdf' | 'txt' | 'ppt' | 'pptx';
  content?: string;
  extractedContent?: ExtractedContent[];
  youtube_id?: string;
  transcript?: any;
}

export interface ExtractedContent {
  text: string;
  pageNumber?: number;
  index?: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  items: VideoItem[];
  createdAt: Date;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  references?: {
    text: string;
    source: ContentSource;
  }[];
  timestamp: string;
  isStudyNotes?: boolean;
}

export interface Chat {
  id: string;
  user_id: string;
  collection_id: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface ContentReference {
  id: string;
  text: string;
  source: ContentSource;
  startIndex: number;
  endIndex: number;
}

export interface ChunkEmbedding {
  text: string;
  embedding: number[];
}

export interface TranscriptResponse {
  transcripts: TranscriptSegment[];
}

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  start: number;
}

export interface Content {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  type: 'youtube' | 'local' | 'pdf' | 'txt' | 'ppt' | 'pptx';
  content?: string;
  url: string;
  created_at: string;
  youtube_id?: string;
  transcript?: string;
} 