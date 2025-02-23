import OpenAI from 'openai';
import cosineSimilarity from 'compute-cosine-similarity';
import { CombinedContent, ContentSource, ContentLocation } from '../types';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true
});

export const generateEmbeddings = async (text: string): Promise<number[] | null> => {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return null;
  }
};

const calculateSimilarity = async (
  embedding1: number[] | null,
  embedding2: number[] | null
): Promise<number> => {
  if (!embedding1 || !embedding2) return 0;
  try {
    // Since we've checked for null above, we can safely assert these are number arrays
    const array1 = embedding1 as number[];
    const array2 = embedding2 as number[];
    return cosineSimilarity(array1, array2);
  } catch (error) {
    console.error('Error calculating similarity:', error);
    return 0;
  }
};

export const findMostRelevantChunks = async (
  question: string,
  content: CombinedContent[],
  limit: number = 5
): Promise<CombinedContent[]> => {
  try {
    const questionEmbedding = await generateEmbeddings(question);
    if (!questionEmbedding) {
      console.error('Failed to generate question embeddings');
      return [];
    }
    
    // Group content by type
    const contentByType = content.reduce((acc, curr) => {
      const type = curr.source.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(curr);
      return acc;
    }, {} as Record<string, CombinedContent[]>);

    // If question mentions specific content type, prioritize that type
    const questionLower = question.toLowerCase();
    const mentionedTypes = {
      youtube: questionLower.includes('video') || questionLower.includes('youtube'),
      pdf: questionLower.includes('pdf') || questionLower.includes('document'),
      ppt: questionLower.includes('powerpoint') || questionLower.includes('presentation'),
      pptx: questionLower.includes('powerpoint') || questionLower.includes('presentation'),
      txt: questionLower.includes('text')
    };

    let relevantContent: CombinedContent[] = [];
    
    // First, add content from specifically mentioned types
    Object.entries(mentionedTypes).forEach(([type, isMentioned]) => {
      if (isMentioned && contentByType[type]) {
        relevantContent.push(...contentByType[type]);
      }
    });

    // If no specific type was mentioned, use all content
    if (relevantContent.length === 0) {
      relevantContent = content;
    }

    // Calculate similarities and sort
    const withSimilarities = await Promise.all(
      relevantContent.map(async (chunk) => {
        const chunkEmbedding = await generateEmbeddings(chunk.text);
        const similarity = await calculateSimilarity(questionEmbedding, chunkEmbedding);
        return { 
          ...chunk, 
          similarity: similarity || 0,
          timestamp: chunk.source.type === 'youtube' && chunk.source.location?.type === 'timestamp' 
            ? getTimestampSeconds(chunk.source.location.value)
            : null
        };
      })
    );

    // Sort by similarity
    const sortedByRelevance = withSimilarities
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity);

    // Filter timestamps that are too close together while maintaining relevance order
    const result: typeof sortedByRelevance = [];
    let lastTimestamp: number | null = null;

    for (const item of sortedByRelevance) {
      if (item.timestamp !== null) {
        // For YouTube content with timestamps
        if (lastTimestamp === null || Math.abs(item.timestamp - lastTimestamp) >= MIN_TIMESTAMP_DIFFERENCE) {
          result.push(item);
          lastTimestamp = item.timestamp;
        }
      } else {
        // For non-YouTube content or content without timestamps
        result.push(item);
      }

      // Break if we have enough items
      if (result.length >= limit) break;
    }

    if (result.length === 0) {
      console.warn('No relevant content found with non-zero similarity');
      // Fallback to returning some content even if similarity is 0
      return relevantContent.slice(0, limit);
    }

    return result;
  } catch (error) {
    console.error('Error finding relevant chunks:', error);
    return content.slice(0, limit); // Fallback to returning some content
  }
};

export const generateStudyNotes = async (contentText: string): Promise<string> => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a helpful study assistant. Create well-structured study notes from the content following these guidelines:

1. Format:
   - Use a clear hierarchical structure with main topics and subtopics
   - Start with a title that summarizes the main topic
   - Include an introduction section
   - Use headings for main sections (##)
   - Use bullet points for key points and details

2. Content:
   - Focus on the most important concepts and ideas
   - Break down complex topics into digestible points
   - Include examples where relevant
   - Keep the language clear and professional

3. References:
   - For video content: Add timestamp references using {ref: MM:SS} format
   - For document content: Add section references using {ref: P#} format (where # is the section number)
   - Add references for each major section
   - Add references for key examples or important points`
   
        },
        {
          role: 'user',
          content: contentText
        }
      ],
      model: 'gpt-3.5-turbo',
    });

    return completion.choices[0].message.content || 'Failed to generate study notes.';
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Failed to generate study notes. Please try again.');
  }
};

const MIN_TIMESTAMP_DIFFERENCE = 15; // Minimum difference in seconds between timestamps

const getTimestampSeconds = (value: string | number): number => {
  if (typeof value === 'string' && value.includes(':')) {
    const [minutes, seconds] = value.split(':').map(Number);
    return (minutes * 60) + seconds;
  }
  return typeof value === 'number' ? value : parseInt(value);
};

const filterCloseTimestamps = (content: CombinedContent[]): CombinedContent[] => {
  // First, separate YouTube content with timestamps from other content
  const timestampContent: (CombinedContent & { timestamp: number })[] = [];
  const otherContent: CombinedContent[] = [];

  // Sort content into appropriate arrays and convert timestamps
  content.forEach(chunk => {
    if (chunk.source.type === 'youtube' && chunk.source.location?.type === 'timestamp') {
      const timestamp = getTimestampSeconds(chunk.source.location.value);
      timestampContent.push({ ...chunk, timestamp });
    } else {
      otherContent.push(chunk);
    }
  });

  // Sort timestamp content chronologically
  timestampContent.sort((a, b) => a.timestamp - b.timestamp);

  // Filter timestamps that are too close
  const filteredTimestamps: typeof timestampContent = [];
  let lastIncludedTimestamp = -MIN_TIMESTAMP_DIFFERENCE; // Initialize to allow first timestamp

  for (const chunk of timestampContent) {
    // Only include if it's far enough from the last included timestamp
    if (chunk.timestamp >= lastIncludedTimestamp + MIN_TIMESTAMP_DIFFERENCE) {
      filteredTimestamps.push(chunk);
      lastIncludedTimestamp = chunk.timestamp;
    }
  }

  // Combine filtered timestamps with other content
  return [...filteredTimestamps, ...otherContent];
};

export const askQuestion = async (
  question: string,
  relevantContent: CombinedContent[]
): Promise<string> => {
  try {
    // Filter out timestamps that are too close together
    const filteredContent = filterCloseTimestamps(relevantContent);
    
    const context = filteredContent
      .map(chunk => {
        const location = chunk.source.location;
        let reference;
        
        if (chunk.source.type === 'youtube' && location?.type === 'timestamp') {
          const timestamp = typeof location.value === 'number' ? location.value : parseInt(location.value.toString());
          const minutes = Math.floor(timestamp / 60);
          const seconds = timestamp % 60;
          const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          reference = `{{ref:youtube:${chunk.source.title}:${formattedTime}}}`;
        } else {
          reference = `{{ref:${chunk.source.type}:${chunk.source.title}:${location?.value ?? 'unknown'}}}`;
        }
        
        return `${chunk.text} ${reference}`;
      })
      .join('\n\n');

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions based on provided content. Follow these STRICT guidelines for citing sources:

1. CRITICAL: Place references IMMEDIATELY after the specific piece of information they support, not at the end of sentences or paragraphs
2. NEVER group references at the end of your response
3. Break up sentences if needed to place references correctly
4. Use exact quotes from the source material when possible
5. Each piece of information should have its reference right after it
6. EXTREMELY CRITICAL: For YouTube timestamps:
   - They MUST be at least 15 seconds apart
   - NEVER use timestamps that are less than 15 seconds apart
   - For timestamps near the start of the video (first minute):
     * Choose only ONE timestamp from each 15-second segment
     * If multiple pieces of information occur within the same 15-second segment,
       pick the most important one and omit the others
     * Do not try to combine information from nearby timestamps
   - For all timestamps:
     * Verify each timestamp is at least 15 seconds from ALL other timestamps
     * If information appears at 0:02 and 0:08, choose only one
     * If information appears at 0:05 and 0:15, choose only one
     * Always round up to the next 15-second interval when choosing timestamps

Example of CORRECT citation with proper timestamp spacing:
"The first key point is introduced {{ref:youtube:Video1:0:15}}. Then after some practice, you'll notice improvement {{ref:youtube:Video1:0:30}}. Finally, mastery comes with dedication {{ref:youtube:Video1:0:45}}."

Example of INCORRECT citation (timestamps too close):
"We begin with the basics {{ref:youtube:Video1:0:02}} and quickly move to fundamentals {{ref:youtube:Video1:0:08}} before advancing {{ref:youtube:Video1:0:15}}."

Format for references:
- YouTube: {{ref:youtube:Video Title:MM:SS}}
- PDF: {{ref:pdf:filename:page_number}}
- PowerPoint: {{ref:pptx:filename:slide_number}}
- Text: {{ref:txt:filename:section_number}}

Additional rules:
- Keep references in their exact format - don't modify them
- For YouTube timestamps, always use MM:SS format
- Don't convert between reference types
- Don't include URLs in references
- Don't summarize or paraphrase references at the end
- Don't add any kind of "References:" section at the end
- Double-check all timestamp differences before including them
- When in doubt, skip timestamps that might be too close together`
        },
        {
          role: 'user',
          content: `Context from multiple sources:\n\n${context}\n\nQuestion: ${question}\n\nAnswer the question based on the provided context. Remember to place each reference IMMEDIATELY after the specific information it supports, and ensure all timestamps are at least 15 seconds apart. For early timestamps (first minute), be especially careful to maintain proper spacing.`
        }
      ],
      model: 'gpt-3.5-turbo',
    });

    return completion.choices[0].message.content || 'No answer found.';
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
};
