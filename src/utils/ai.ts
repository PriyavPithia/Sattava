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
    // Since we've checked for null above, we can safely use the arrays
    return cosineSimilarity(embedding1, embedding2) || 0;
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

1. ABSOLUTELY CRITICAL - INLINE CITATIONS:
   - Place each reference IMMEDIATELY after the specific fact or quote it supports
   - NEVER group references at the end of sentences
   - NEVER group references at the end of paragraphs
   - NEVER save references for the end of your response
   - Break up sentences to place references correctly
   - Each distinct piece of information must have its own reference right after it

2. CITATION FORMAT:
   - Use exact quotes whenever possible
   - Keep references in their exact format
   - Don't modify reference formats
   - Don't combine references

3. TIMESTAMP RULES:
   - Must be at least 15 seconds apart
   - For early video timestamps:
     * Choose only ONE timestamp from each 15-second segment
     * Pick the most important information if multiple occur in same segment
   - Always verify timestamp spacing

Here are examples of CORRECT inline citations:

CORRECT (references immediately after each fact):
"Learning a new skill requires patience {{ref:youtube:Video1:0:15}}. The brain needs time to process new information {{ref:youtube:Video1:0:30}}. Practice sessions should be structured {{ref:youtube:Video1:0:45}}."

CORRECT (breaking up sentences for proper citation):
"The first step is understanding the basics {{ref:youtube:Video1:1:00}}. Then you can move on to advanced concepts {{ref:youtube:Video1:1:15}}."

Here are examples of INCORRECT citations:

INCORRECT (grouped at end of sentence):
"The process involves understanding basics and then moving to advanced concepts {{ref:youtube:Video1:1:00}} {{ref:youtube:Video1:1:15}}."

INCORRECT (timestamps too close):
"First understand the concept {{ref:youtube:Video1:0:02}} and then practice the basics {{ref:youtube:Video1:0:08}}."

INCORRECT (references at end):
"The learning process has several steps. First you need to understand the basics. Then you practice regularly. Finally, you test your knowledge {{ref:youtube:Video1:0:15}} {{ref:youtube:Video1:0:30}} {{ref:youtube:Video1:0:45}}."

Format for references:
- YouTube: {{ref:youtube:Video Title:MM:SS}}
- PDF: {{ref:pdf:filename:page_number}}
- PowerPoint: {{ref:pptx:filename:slide_number}}
- Text: {{ref:txt:filename:section_number}}

Additional rules:
- Each fact must have its own reference immediately after
- Never combine multiple facts under a single reference
- Never save references for the end of sentences
- Never group multiple references together
- Break up compound sentences into simple ones
- Each timestamp must be at least 15 seconds apart
- When in doubt, break up the text and cite more frequently`
        },
        {
          role: 'user',
          content: `Context from multiple sources:\n\n${context}\n\nQuestion: ${question}\n\nAnswer the question based on the provided context. Remember to cite each piece of information IMMEDIATELY after mentioning it, never grouping citations at the end of sentences or paragraphs.`
        }
      ],
      model: 'gpt-3.5-turbo',
      temperature: 0.5, // Add lower temperature for more consistent formatting
    });

    return completion.choices[0].message.content || 'No answer found.';
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
};
