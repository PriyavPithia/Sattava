import { Message, ContentSource } from './index';

export interface ContentLocation {
  type: 'timestamp' | 'page' | 'section' | 'slide';
  value: number;
}

export interface Reference {
  text: string;
  source: ContentSource;
}

export interface MessageWithReferences extends Message {
  references?: Reference[];
} 