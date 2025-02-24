export interface ContentLocation {
  type: 'timestamp' | 'page' | 'section' | 'slide';
  value: string | number;
}

export interface ContentSource {
  type: 'youtube' | 'pdf' | 'txt' | 'ppt' | 'pptx';
  title: string;
  location?: ContentLocation;
}

export interface CombinedContent {
  text: string;
  source: ContentSource;
}

export interface VideoItem {
  id: string;
  url: string;
  title: string;
  isEditing?: boolean;
  type: 'youtube' | 'local' | 'pdf' | 'txt' | 'ppt' | 'pptx';
  content?: string;
  extractedContent?: ExtractedContent[];
  transcript?: any[];
  youtube_id?: string;
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