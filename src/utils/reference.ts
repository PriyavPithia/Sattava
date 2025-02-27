import { Reference, ContentLocation } from '../types/reference';
import { ContentSource } from '../types';

export const createReference = (
  sourceType: ContentSource['type'],
  sourceTitle: string,
  location: ContentLocation,
  text: string
): Reference => {
  return {
    text,
    source: {
      type: sourceType,
      title: sourceTitle,
      location
    }
  };
};

export const formatReference = (reference: Reference): string => {
  if (reference.source.type === 'youtube') {
    const seconds = reference.source.location?.value || 0;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timestamp = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    return `[${timestamp}]`;
  }
  
  return `[${reference.source.title} on page ${reference.source.location?.value}]`;
};

export const parseReferenceTag = (tag: string): Reference | null => {
  try {
    const parts = tag.slice(6, -2).split(':');
    console.log('Parsing reference tag:', tag, 'Parts:', parts);
    
    // Handle YouTube format
    if (parts[0] === 'youtube' && parts.length >= 3) {
      const [_, title, timestamp] = parts;
      return createReference(
        'youtube',
        title,
        {
          type: 'timestamp',
          value: timestamp.includes(':') 
            ? convertTimestampToSeconds(timestamp)
            : parseInt(timestamp)
        },
        `Content from video at ${timestamp}`
      );
    }

    // Handle file references (pdf, txt, ppt, pptx)
    if (parts.length >= 3) {
      const [sourceType, fileName, pageNumber] = parts;
      console.log('Creating file reference:', { sourceType, fileName, pageNumber });
      
      const locationType = sourceType === 'txt' 
        ? 'section' 
        : sourceType === 'ppt' || sourceType === 'pptx'
          ? 'slide'
          : 'page';
      
      const value = parseInt(pageNumber);
      if (isNaN(value)) {
        console.error('Invalid page/section/slide number:', pageNumber);
        return null;
      }
      
      return createReference(
        sourceType as ContentSource['type'],
        fileName,
        {
          type: locationType,
          value
        },
        `Content from ${fileName} at ${pageNumber}`
      );
    }

    console.log('Reference tag did not match any format:', tag);
    return null;
  } catch (error) {
    console.error('Error parsing reference tag:', error, 'Tag:', tag);
    return null;
  }
};

export const extractReferences = (content: string): { text: string; references: Reference[] } => {
  const references: Reference[] = [];
  let currentIndex = 0;

  const text = content.replace(/\{\{ref:[^}]+\}\}/g, (match) => {
    const reference = parseReferenceTag(match);
    if (reference) {
      references.push(reference);
      return `__REF_MARKER_${currentIndex++}__`;
    }
    return match;
  });

  return { text, references };
};

const convertTimestampToSeconds = (timestamp: string): number => {
  const [minutes, seconds] = timestamp.split(':').map(Number);
  return (minutes * 60) + seconds;
}; 