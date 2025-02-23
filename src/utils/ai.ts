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
    return cosineSimilarity(embedding1 as number[], embedding2 as number[]);
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
    // First, consolidate nearby timestamps for the same video
    const consolidatedContent = relevantContent.reduce<CombinedContent[]>((acc, current) => {
      if (acc.length === 0) return [current];

      const last = acc[acc.length - 1];
      
      // Only combine if from same video and within 3 seconds (reduced from 10)
      if (
        last.source.type === 'youtube' &&
        current.source.type === 'youtube' &&
        last.source.title === current.source.title &&
        last.source.location?.type === 'timestamp' &&
        current.source.location?.type === 'timestamp' &&
        typeof last.source.location.value === 'number' &&
        typeof current.source.location.value === 'number' &&
        Math.abs(current.source.location.value - last.source.location.value) <= 3
      ) {
        // Combine the text and use the earlier timestamp
        return [
          ...acc.slice(0, -1),
          {
            text: `${last.text} ${current.text}`,
            source: {
              ...last.source,
              location: {
                type: 'timestamp' as const,
                value: Math.min(
                  last.source.location.value,
                  current.source.location.value
                )
              }
            }
          }
        ];
      }

      return [...acc, current];
    }, []);

    const context = consolidatedContent
      .map(chunk => {
        const location = chunk.source.location;
        let reference;
        
        if (chunk.source.type === 'youtube' && location?.type === 'timestamp') {
          const timestamp = typeof location.value === 'number' ? location.value : parseInt(location.value.toString(), 10);
          if (isNaN(timestamp)) {
            console.error('Invalid timestamp value:', location.value);
            return `${chunk.text} {{ref:youtube:${chunk.source.title}:0:00}}`;
          }
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

1. ALWAYS place references IMMEDIATELY after the specific text they refer to, not at the end of sentences or paragraphs
2. Use this exact format for references:
   - YouTube: {{ref:youtube:Video Title:MM:SS}}
   - PDF: {{ref:pdf:filename:page_number}}
   - PowerPoint: {{ref:pptx:filename:slide_number}}
   - Text: {{ref:txt:filename:section_number}}

3. Example of correct citation:
   "The speed increased dramatically {{ref:youtube:My Video:1:30}} and continued to rise over time."

4. Rules:
   - Place each reference immediately after the specific text it refers to
   - Keep the exact text from the source when citing
   - For YouTube, use MM:SS format (e.g., 1:30, not 90 seconds)
   - Never group references at the end
   - Never include URLs in references
   - For PDFs, use page numbers (e.g., {{ref:pdf:Document.pdf:5}})
   - For PowerPoint, use slide numbers (e.g., {{ref:pptx:Presentation.pptx:3}})
   - For text files, use section numbers (e.g., {{ref:txt:Notes.txt:2}})
   - NEVER convert PDF or PowerPoint references to text references
   - NEVER combine multiple pieces of information into a single sentence
   - Each distinct piece of information should be its own sentence with its own reference
   - Keep sentences short and focused on one piece of information
   - Add a line break between each cited piece of information for better readability`
        },
        {
          role: 'user',
          content: `Context from multiple sources:\n\n${context}\n\nQuestion: ${question}\n\nAnswer the question based on the provided context. Remember to:\n1. Place each reference immediately after its specific text\n2. Keep sentences short and focused\n3. Put each cited piece of information on its own line\n4. Never combine multiple pieces of information into one sentence`
        }
      ],
      model: 'gpt-3.5-turbo',
      temperature: 0.5, // Lower temperature for more consistent formatting
    });

    return completion.choices[0].message.content || 'No answer found.';
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
};
