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

export async function generateStudyNotes(content: string, contentSources: CombinedContent[]): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a study notes assistant. Create concise, well-structured notes following this format:

# Main Topic

## Key Concepts
- Point 1 {{ref:type:source:location}}
- Point 2 {{ref:type:source:location}}

## Important Terms
- Term 1: Definition {{ref:type:source:location}}
- Term 2: Definition {{ref:type:source:location}}

## Summary
Brief summary of main points

Use markdown formatting. Keep points brief and focused. Highlight key terms in **bold**.
Each point should include at least one reference in the format {{ref:type:source:location}}.
References should be placed immediately after the relevant information.`
        },
        {
          role: "user",
          content: `Create study notes from this content. Focus on the most important concepts and definitions. Include references to the source material:\n\n${contentSources.map(source => 
            `${source.text} {{ref:${source.source.type}:${source.source.title}:${source.source.location?.value || '1'}}}`
          ).join('\n\n')}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    return response.choices[0]?.message?.content || 'No notes generated';
  } catch (error) {
    console.error('Error in generateStudyNotes:', error);
    throw new Error('Failed to generate study notes');
  }
}

const MIN_TIMESTAMP_DIFFERENCE = 30; // Increased from 15 to 30 seconds for better context

const getTimestampSeconds = (value: string | number): number => {
  if (typeof value === 'string' && value.includes(':')) {
    const [minutes, seconds] = value.split(':').map(Number);
    return (minutes * 60) + (seconds || 0); // Added fallback for invalid seconds
  }
  return typeof value === 'number' ? value : parseInt(value) || 0; // Added fallback for invalid parsing
};

const filterCloseTimestamps = (content: CombinedContent[]): CombinedContent[] => {
  // First, separate YouTube content with timestamps from other content
  const timestampContent: (CombinedContent & { 
    timestamp: number;
    similarity?: number;
  })[] = [];
  const otherContent: CombinedContent[] = [];

  // Sort content into appropriate arrays and convert timestamps
  content.forEach(chunk => {
    if (chunk.source.type === 'youtube' && chunk.source.location?.type === 'timestamp') {
      const timestamp = getTimestampSeconds(chunk.source.location.value);
      // Only add if timestamp is valid
      if (!isNaN(timestamp) && timestamp >= 0) {
        timestampContent.push({ 
          ...chunk, 
          timestamp,
          similarity: (chunk as any).similarity
        });
      }
    } else {
      otherContent.push(chunk);
    }
  });

  // Sort timestamp content chronologically
  timestampContent.sort((a, b) => a.timestamp - b.timestamp);

  // Filter timestamps that are too close together while preserving context
  const filteredTimestamps: typeof timestampContent = [];
  let lastIncludedTimestamp = -MIN_TIMESTAMP_DIFFERENCE;

  for (let i = 0; i < timestampContent.length; i++) {
    const chunk = timestampContent[i];
    const nextChunk = timestampContent[i + 1];
    
    // Include if far enough from last timestamp OR if it provides important context
    if (chunk.timestamp >= lastIncludedTimestamp + MIN_TIMESTAMP_DIFFERENCE || 
        (nextChunk && nextChunk.timestamp - chunk.timestamp <= MIN_TIMESTAMP_DIFFERENCE && 
         chunk.similarity && chunk.similarity > 0.7)) { // High similarity threshold for context
      filteredTimestamps.push(chunk);
      lastIncludedTimestamp = chunk.timestamp;
    }
  }

  // Combine filtered timestamps with other content
  return [...filteredTimestamps, ...otherContent];
};

// Add this validation function
const validateReference = (chunk: CombinedContent): boolean => {
  const { source } = chunk;
  // Check if source has all required properties
  if (!source || !source.type || !source.title || !source.location) {
    return false;
  }
  
  // Validate source type
  const validTypes = ['youtube', 'pdf', 'txt', 'ppt', 'pptx'];
  if (!validTypes.includes(source.type)) {
    return false;
  }

  // Validate location
  if (!source.location.type || !source.location.value) {
    return false;
  }

  return true;
};

// Add this function to format references consistently
const formatReference = (chunk: CombinedContent): string => {
  const { source } = chunk;
  
  if (!validateReference(chunk)) {
    console.warn('Invalid reference format:', chunk);
    return '';
  }

  if (source.type === 'youtube' && source.location.type === 'timestamp') {
    const timestamp = getTimestampSeconds(source.location.value);
    if (isNaN(timestamp) || timestamp < 0) return '';
    
    const minutes = Math.floor(timestamp / 60);
    const seconds = timestamp % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    return `{{ref:youtube:${source.title}:${formattedTime}}}`;
  }

  // For other content types
  return `{{ref:${source.type}:${source.title}:${source.location.value}}}`;
};

export async function askQuestion(
  question: string,
  relevantContent: CombinedContent[]
): Promise<string> {
  try {
    // Filter out timestamps that are too close together
    const filteredContent = filterCloseTimestamps(relevantContent);
    
    // Validate and format references
    const context = filteredContent
      .map(chunk => {
        const reference = formatReference(chunk);
        if (!reference) return ''; // Skip invalid references
        return `${chunk.text} ${reference}`;
      })
      .filter(Boolean) // Remove empty strings from invalid references
      .join('\n\n');

    // Update the system prompt to be more explicit about reference format
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a knowledgeable AI assistant that provides clear, direct answers. You MUST follow these formatting rules:

1. RESPONSE FORMAT (REQUIRED):
   - Start with a clear # heading that states the main topic
   - Provide a direct, concise answer in the first paragraph
   - Use markdown formatting consistently
   - Break complex answers into logical sections with ## subheadings
   - Use bullet points (-) for lists when needed
   - Highlight important terms with **bold**

2. WRITING STYLE (REQUIRED):
   - Be clear and direct
   - Use natural, conversational language
   - Avoid academic or overly formal tone
   - Explain concepts simply
   - Give practical examples when relevant

3. CITATION RULES (MANDATORY):
   - Place each reference IMMEDIATELY after its corresponding statement
   - Break up long paragraphs into individual cited statements
   - NEVER group references at the end of paragraphs
   - NEVER save references for the end of the response
   - Use this EXACT format for references:
     * YouTube: {{ref:youtube:video_title:MM:SS}}
     * PDF: {{ref:pdf:document_title:page_number}}
     * Other files: {{ref:type:title:location}}

Example of CORRECT reference placement:

# Understanding Machine Learning

The basic concept of machine learning involves pattern recognition {{ref:youtube:Intro to ML:1:30}}. Neural networks are designed to mimic human brain function {{ref:pdf:ML Basics:12}}. This architecture allows for complex data processing {{ref:youtube:Neural Nets:2:15}}.

## Key Applications

- Image recognition systems can identify objects in photographs {{ref:youtube:Computer Vision:3:45}}
- Natural language processing enables chatbots to understand human input {{ref:pdf:NLP Guide:8}}
- Predictive analytics helps forecast market trends {{ref:youtube:ML in Business:5:20}}

Example of INCORRECT reference placement (DO NOT DO THIS):

# Machine Learning Overview

The basic concept of machine learning involves pattern recognition. Neural networks are designed to mimic human brain function. This architecture allows for complex data processing. {{ref:youtube:Intro to ML:1:30}} {{ref:pdf:ML Basics:12}} {{ref:youtube:Neural Nets:2:15}}

Remember:
- Each statement needs its own immediate reference
- Never group references at the end
- Keep references close to their content
- Break up text to allow for proper citation`
        },
        {
          role: 'user',
          content: `Provide a clear, direct answer with proper formatting and references for this question: ${question}\n\nContext:\n${context}`
        }
      ],
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
    });

    return completion.choices[0].message.content || 'No answer found.';
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
}
