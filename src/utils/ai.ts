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
    
    // Debug log the incoming content
    console.log('DEBUG: Incoming content timestamps:', content.map(c => 
      c.source.type === 'youtube' ? c.source.location?.value : null
    ));

    // Calculate similarities without modifying timestamps
    const withSimilarities = await Promise.all(
      content.map(async (chunk) => {
        const chunkEmbedding = await generateEmbeddings(chunk.text);
        const similarity = await calculateSimilarity(questionEmbedding, chunkEmbedding);
        
        // Keep original timestamp value
        const timestamp = chunk.source.type === 'youtube' && chunk.source.location?.type === 'timestamp'
          ? chunk.source.location.value
          : null;
        
        return { 
          ...chunk, 
          similarity: similarity || 0,
          originalTimestamp: timestamp // Store original timestamp
        };
      })
    );

    // Sort by similarity
    const sortedByRelevance = withSimilarities
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity);

    // Filter timestamps that are too close together
    const result: typeof sortedByRelevance = [];
    let lastTimestamp: number | null = null;

    for (const item of sortedByRelevance) {
      if (item.originalTimestamp !== null && item.originalTimestamp !== undefined) {
        const timestampStr = String(item.originalTimestamp);
        const currentTimestamp = timestampStr.includes(':')
          ? getTimestampSeconds(timestampStr)
          : Number(item.originalTimestamp);

        if (currentTimestamp !== null && !isNaN(currentTimestamp)) {
          if (lastTimestamp === null || Math.abs(currentTimestamp - lastTimestamp) >= MIN_TIMESTAMP_DIFFERENCE) {
            result.push(item);
            lastTimestamp = currentTimestamp;
          }
        } else {
          console.warn('Invalid timestamp:', item.originalTimestamp);
        }
      } else {
        result.push(item);
      }

      if (result.length >= limit) break;
    }

    // Debug log the results
    console.log('DEBUG: Selected content timestamps:', result.map(r => r.originalTimestamp));

    return result;
  } catch (error) {
    console.error('Error finding relevant chunks:', error);
    return content.slice(0, limit);
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

const getTimestampSeconds = (value: string | number): number | null => {
  try {
    // Handle MM:SS format
    if (typeof value === 'string' && value.includes(':')) {
      const parts = value.split(':');
      if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        if (!isNaN(minutes) && !isNaN(seconds)) {
          return (minutes * 60) + seconds;
        }
      }
      return null;
    }
    
    // Handle direct number input
    if (typeof value === 'number' && !isNaN(value)) {
      return Math.max(0, Math.floor(value));
    }
    
    // Handle string number
    const parsed = parseInt(value as string, 10);
    return !isNaN(parsed) ? Math.max(0, Math.floor(parsed)) : null;
  } catch (error) {
    console.error('Error parsing timestamp:', error);
    return null;
  }
};

const formatTimestamp = (seconds: number | null): string | null => {
  try {
    if (seconds === null || isNaN(seconds)) {
      return null;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (isNaN(minutes) || isNaN(remainingSeconds)) {
      return null;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return null;
  }
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
      const timestampValue = getTimestampSeconds(chunk.source.location.value);
      // Only add if timestamp is valid
      if (timestampValue !== null) {
        timestampContent.push({ 
          ...chunk, 
          timestamp: timestampValue,
          similarity: (chunk as any).similarity
        });
      } else {
        otherContent.push(chunk);
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

export async function askQuestion(
  question: string,
  relevantContent: CombinedContent[]
): Promise<string> {
  try {
    const filteredContent = filterCloseTimestamps(relevantContent);
    
    console.log('DEBUG: Processing content for references:', filteredContent.map(c => ({
      type: c.source.type,
      timestamp: c.source.location?.value
    })));

    const context = filteredContent
      .map(chunk => {
        const location = chunk.source.location;
        let reference;
        
        if (chunk.source.type === 'youtube' && location?.type === 'timestamp') {
          try {
            const originalTimestamp = location.value;
            console.log('DEBUG: Processing timestamp:', originalTimestamp);

            // If it's already in MM:SS format, use it directly
            const timestampStr = String(originalTimestamp);
            if (timestampStr.includes(':')) {
              reference = `{{ref:youtube:${chunk.source.title}:${timestampStr}}}`;
            } else {
              // Only convert if it's a number
              const timestamp = Number(originalTimestamp);
              if (!isNaN(timestamp) && timestamp > 0) {
                const formattedTime = formatTimestamp(timestamp);
                if (formattedTime) {
                  reference = `{{ref:youtube:${chunk.source.title}:${formattedTime}}}`;
                } else {
                  console.warn('Failed to format timestamp:', timestamp);
                  return '';
                }
              } else {
                console.warn('Invalid timestamp value:', originalTimestamp);
                return '';
              }
            }
          } catch (error) {
            console.error('Error processing YouTube timestamp:', error);
            return '';
          }
        } else {
          reference = `{{ref:${chunk.source.type}:${chunk.source.title}:${location?.value ?? 'unknown'}}}`;
        }
        
        return `${chunk.text} ${reference}`;
      })
      .filter(Boolean)
      .join('\n\n');

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
   - Every statement must have a reference
   - Place references immediately after each statement
   - Format: statement {{ref}} next statement {{ref}}
   - Never group references
   - Never leave statements unreferenced

Example format:

# [Question Topic]

Here's a clear answer to your question {{ref}}. This leads to an important point {{ref}}.

## Additional Context

This provides more detail about the topic {{ref}}. Here's a practical example {{ref}}.

## Key Points

- First important point to understand {{ref}}
- Second relevant point {{ref}}
- Final clarifying point {{ref}}

Remember:
- Keep responses clear and direct
- Use natural language
- Include references for all statements
- Maintain clean formatting`
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
