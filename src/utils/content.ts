import { ContentChunk } from '../types';

const CHUNK_SIZE = 1000; // Approximate characters per chunk
const OVERLAP = 200; // Overlap between chunks to maintain context

export const processTextContent = (content: string): ContentChunk[] => {
  const chunks: ContentChunk[] = [];
  const sentences = content.split(/(?<=[.!?])\s+/);
  
  let currentChunk = '';
  let startOffset = 0;
  let pageNumber = 1;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    if ((currentChunk + sentence).length > CHUNK_SIZE && currentChunk.length > 0) {
      // Store current chunk
      chunks.push({
        text: currentChunk,
        startOffset,
        endOffset: startOffset + currentChunk.length,
        pageNumber,
        context: extractContext(currentChunk)
      });
      
      // Start new chunk with overlap
      const lastSentences = getLastSentences(currentChunk, OVERLAP);
      currentChunk = lastSentences + sentence;
      startOffset = startOffset + currentChunk.length - lastSentences.length;
      pageNumber++;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  // Add the last chunk
  if (currentChunk) {
    chunks.push({
      text: currentChunk,
      startOffset,
      endOffset: startOffset + currentChunk.length,
      pageNumber,
      context: extractContext(currentChunk)
    });
  }
  
  return chunks;
};

export const processPDFContent = async (pdfData: ArrayBuffer): Promise<ContentChunk[]> => {
  // This is a placeholder - implement actual PDF processing logic
  // You'll want to use pdf.js to extract text and maintain page numbers
  return [];
};

export const processPPTContent = async (pptData: ArrayBuffer): Promise<ContentChunk[]> => {
  // This is a placeholder - implement actual PPT processing logic
  // You'll want to use your existing PPT extraction logic and maintain slide numbers
  return [];
};

const extractContext = (text: string): string => {
  // Extract the first sentence or heading as context
  const firstSentence = text.split(/[.!?]/, 1)[0];
  return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;
};

const getLastSentences = (text: string, targetLength: number): string => {
  const sentences = text.split(/(?<=[.!?])\s+/);
  let result = '';
  
  for (let i = sentences.length - 1; i >= 0; i--) {
    const newResult = sentences[i] + (result ? ' ' + result : '');
    if (newResult.length > targetLength) {
      return result;
    }
    result = newResult;
  }
  
  return result;
}; 