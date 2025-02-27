export interface VideoItem {
  id: string;
  url: string;
  title: string;
  isEditing?: boolean;
  type: 'youtube' | 'local' | 'pdf' | 'txt' | 'ppt' | 'pptx';
  content?: string;
  extractedContent?: ExtractedContent[];
}

export interface ChunkEmbedding {
  text: string;
  embedding: number[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  references?: CombinedContent[];
}

export interface TranscriptModal {
  isOpen: boolean;
  timestamp: number;
  text: string;
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

export interface CombinedContent {
  text: string;
  source: {
    type: 'youtube' | 'pdf' | 'txt' | 'ppt' | 'pptx';
    title: string;
    location?: string;
  };
} 