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
          content: `You are a study notes assistant. Create concise, well-structured notes with proper formatting and clickable references.

When creating notes:
1. Use **bold** for section titles and key terms (use double asterisks)
2. Format references as {{ref:type:source:page}} immediately after each point
3. Use bullet points (•) for lists
4. Maintain consistent spacing between sections

Example format:

**Learning Styles and Studying**

**Key Concepts**
• **Active Learning**: Engaging directly with the material {{ref:txt:LECTURE-1.2.txt:1}}
• **Metacognition**: Thinking about one's own learning process {{ref:pdf:SUS week3.pdf:1}}

**Important Terms**
• **Learning Styles**: Different ways of processing information {{ref:pdf:SUS week3.pdf:1}}
• **Study Strategies**: Methods to enhance learning effectiveness {{ref:pdf:SUS week3.pdf:1}}

**Summary**
A concise paragraph summarizing the key points and their relationships {{ref:pdf:SUS week3.pdf:1}}

Remember:
- Every section title must be in **bold**
- Every key term must be in **bold**
- Every point must have a reference
- References must be in {{ref:type:source:page}} format
- No markdown headers (#) - use **bold** for titles instead`
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

export async function askQuestion(
  question: string,
  relevantContent: CombinedContent[]
): Promise<string> {
  try {
    // Filter out timestamps that are too close together
    const filteredContent = filterCloseTimestamps(relevantContent);
    
    const context = filteredContent
      .map(chunk => {
        const location = chunk.source.location;
        let reference;
        
        if (chunk.source.type === 'youtube' && location?.type === 'timestamp') {
          let timestamp = 0;
          try {
            const locationValue = location.value as string | number;
            if (typeof locationValue === 'number') {
              timestamp = locationValue;
            } else if (typeof locationValue === 'string') {
              // Handle MM:SS format
              if (locationValue.includes(':')) {
                const [minutes, seconds] = locationValue.split(':').map(Number);
                if (!isNaN(minutes) && !isNaN(seconds)) {
                  timestamp = (minutes * 60) + seconds;
                }
              } else {
                // Handle raw seconds
                const parsed = parseInt(locationValue);
                if (!isNaN(parsed)) {
                  timestamp = parsed;
                }
              }
            }
          } catch (error) {
            console.error('Error parsing timestamp:', error);
          }

          const minutes = Math.floor(timestamp / 60);
          const seconds = Math.floor(timestamp % 60);
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
