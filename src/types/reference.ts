import { Message, ContentSource } from './index';

export interface ContentLocation {
  type: 'timestamp' | 'page';
  value: string | number;
}

export interface Reference {
  text: string;
  source: ContentSource;
}

export interface MessageWithReferences extends Message {
  references?: Reference[];
} 