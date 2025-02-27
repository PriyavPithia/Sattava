import { Reference, ContentLocation } from '../types/reference';

export const createReference = (
  sourceId: string,
  sourceType: 'youtube' | 'pdf' | 'txt' | 'ppt' | 'pptx',
  sourceTitle: string,
  location: ContentLocation,
  text: string,
  context?: string
): Reference => {
  return {
    sourceId,
    sourceType,
    sourceTitle,
    location,
    text,
    context
  };
};

export const formatReference = (reference: Reference): string => {
  if (reference.sourceType === 'youtube') {
    const seconds = typeof reference.location.value === 'string' 
      ? parseInt(reference.location.value) 
      : reference.location.value;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timestamp = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    return `[${timestamp}]`;
  }
  
  return `[${reference.sourceTitle} on page ${reference.location.value}]`;
};

export const parseReferenceTag = (tag: string): Reference | null => {
  try {
    const parts = tag.slice(6, -2).split(':');
    console.log('Parsing reference tag:', tag, 'Parts:', parts);
    
    // Handle YouTube format
    if (parts[0] === 'youtube' && parts.length >= 3) {
      const [_, __, videoUrl, timestamp] = parts;
      return createReference(
        videoUrl,
        'youtube',
        'YouTube Video',
        {
          type: 'timestamp',
          value: parseInt(timestamp)
        },
        `Reference at ${timestamp} seconds`
      );
    }

    // Handle file references (pdf, txt, ppt, pptx)
    if (parts.length >= 3) {
      const [sourceType, fileName, pageNumber] = parts;
      console.log('Creating file reference:', { sourceType, fileName, pageNumber });
      
      // Create reference based on file type
      if (sourceType === 'txt') {
        return createReference(
          fileName,
          'txt',
          fileName,
          {
            type: 'section',
            value: parseInt(pageNumber) || pageNumber
          },
          `Reference to section ${pageNumber} in ${fileName}`
        );
      } else {
        // Keep existing handling for other file types
        return createReference(
          fileName,
          sourceType as 'pdf' | 'ppt' | 'pptx',
          fileName,
          {
            type: 'page',
            value: parseInt(pageNumber) || pageNumber
          },
          `Reference to page ${pageNumber} in ${fileName}`
        );
      }
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
    console.log('Found reference tag:', match);
    const reference = parseReferenceTag(match);
    if (reference) {
      references.push(reference);
      const marker = `__REF_MARKER_${references.length - 1}__`;
      console.log('Created marker:', marker, 'for reference:', reference);
      return marker;
    }
    console.log('Failed to parse reference tag:', match);
    return match;
  });

  console.log('Extracted references:', references);
  console.log('Processed text:', text);

  return { text, references };
}; 