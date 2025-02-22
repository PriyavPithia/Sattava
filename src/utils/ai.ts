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
    return cosineSimilarity(embedding1, embedding2);
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
          similarity: similarity || 0 
        };
      })
    );

    // Filter out items with zero similarity and sort by similarity
    const sortedContent = withSimilarities
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    if (sortedContent.length === 0) {
      console.warn('No relevant content found with non-zero similarity');
      // Fallback to returning some content even if similarity is 0
      return relevantContent.slice(0, limit);
    }

    return sortedContent;
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

export const askQuestion = async (
  question: string,
  relevantContent: CombinedContent[]
): Promise<string> => {
  try {
    // Format context with structured references
    const context = relevantContent
      .map(chunk => {
        const location = chunk.source.location;
        let reference;
        
        if (chunk.source.type === 'youtube' && location?.type === 'timestamp') {
          reference = `{{ref:youtube:${chunk.source.title}:${location.value}}}`;
        } else {
          reference = `{{ref:${chunk.source.type}:${chunk.source.title}:${location?.value}}}`;
        }
        
        return `${chunk.text} ${reference}`;
      })
      .join('\n\n');

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions based on multiple sources. 
          When citing content, immediately follow the cited text with its reference using this format:
          
          Reference formats:
          - YouTube: {{ref:youtube:Video Title:timestamp}} (e.g., {{ref:youtube:My Video:6}} for 0:06)
          - PDF: {{ref:pdf:filename:page_number}}
          - PowerPoint: {{ref:pptx:filename:slide_number}}
          - Text: {{ref:txt:filename:section_number}}
          
          Example: "The speed increased dramatically {{ref:youtube:My Video:6}} and then..."
          
          IMPORTANT:
          1. For YouTube timestamps, use the number of seconds only (e.g., 6 for 0:06)
          2. Do NOT include YouTube URLs in references, just use the video title and timestamp
          3. Place references IMMEDIATELY after the text they refer to
          4. Do not group references at the end
          5. Each piece of cited text must have its reference right after it
          6. Keep the original text exactly as provided in the context`
        },
        {
          role: 'user',
          content: `Context from multiple sources:\n\n${context}\n\nQuestion: ${question}\n\nAnswer the question based on the provided context, citing sources where appropriate.`
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
