import { Reference } from '../types/reference';
import { ContentSource, ContentLocation } from '../types';

export const extractReferences = (content: string): { text: string; references: Reference[] } => {
  const references: Reference[] = [];
  let currentIndex = 0;

  const text = content.replace(/\{\{ref:[^}]+\}\}/g, (match) => {
    console.log('Found reference tag:', match);
    const parts = match.slice(6, -2).split(':');
    
    // Create a default reference for invalid formats
    if (parts.length < 3) {
      const type = parts[0];
      const reference: Reference = {
        text: `Reference to ${type}`,
        source: {
          type: 'txt',
          title: type,
          location: {
            type: 'page',
            value: 1
          }
        }
      };
      references.push(reference);
      const marker = `__REF_MARKER_${references.length - 1}__`;
      console.log('Created marker for invalid reference:', marker, reference);
      return marker;
    }
    
    const [type, title, location] = parts;
    
    // Create reference based on type
    const reference: Reference = {
      text: `Reference from ${title}`,
      source: {
        type: type as ContentSource['type'],
        title: title,
        location: {
          type: type === 'youtube' ? 'timestamp' : 'page',
          value: type === 'youtube' ? parseTimestamp(location) : parseInt(location)
        }
      }
    };
    
    references.push(reference);
    const marker = `__REF_MARKER_${references.length - 1}__`;
    console.log('Created marker:', marker, 'for reference:', reference);
    return marker;
  });

  console.log('Extracted references:', references);
  console.log('Processed text:', text);

  return { text, references };
};

export const formatReference = (reference: Reference): string => {
  const location = reference.source.location;
  if (reference.source.type === 'youtube') {
    const seconds = location.value;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timestamp = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    return `[${timestamp}]`;
  }
  
  return `[${reference.source.title} on page ${location.value}]`;
};

export const parseReferenceTag = (tag: string): Reference | null => {
  try {
    const parts = tag.slice(6, -2).split(':');
    console.log('Parsing reference tag:', tag, 'Parts:', parts);
    
    // Handle YouTube format
    if (parts[0] === 'youtube' && parts.length >= 3) {
      const [_, __, videoUrl, timestamp] = parts;
      return {
        text: `Reference at ${timestamp} seconds`,
        source: {
          type: 'youtube',
          title: videoUrl,
          location: {
            type: 'timestamp',
            value: parseInt(timestamp)
          }
        }
      };
    }

    // Handle file references (pdf, txt, ppt, pptx)
    if (parts.length >= 3) {
      const [sourceType, fileName, pageNumber] = parts;
      console.log('Creating file reference:', { sourceType, fileName, pageNumber });
      
      return {
        text: `Reference to page ${pageNumber} in ${fileName}`,
        source: {
          type: sourceType as ContentSource['type'],
          title: fileName,
          location: {
            type: 'page',
            value: parseInt(pageNumber)
          }
        }
      };
    }

    console.log('Reference tag did not match any format:', tag);
    return null;
  } catch (error) {
    console.error('Error parsing reference tag:', error, 'Tag:', tag);
    return null;
  }
};

// Helper function to parse timestamp from MM:SS format or raw seconds
const parseTimestamp = (timestamp: string): number => {
  if (timestamp.includes(':')) {
    const [minutes, seconds] = timestamp.split(':').map(Number);
    return (minutes * 60) + seconds;
  }
  return parseInt(timestamp);
}; 