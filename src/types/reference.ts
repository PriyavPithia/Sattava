export interface ContentLocation {
  type: 'timestamp' | 'page';
  value: string | number;
}

export interface Reference {
  sourceId: string;
  sourceType: 'youtube' | 'pdf' | 'txt' | 'ppt' | 'pptx';
  sourceTitle: string;
  location: ContentLocation;
  text: string;
  context?: string;
}

export interface MessageWithReferences extends Message {
  references?: Reference[];
} 