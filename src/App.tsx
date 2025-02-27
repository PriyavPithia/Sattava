import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';
import axios from 'axios';
import { FileText, Plus, Home, Upload, UserCircle, LogOut, CheckCircle, XCircle } from 'lucide-react';
import OpenAI from 'openai';
import { useNavigate, Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { getDocument } from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

import { TranscriptSegment, TranscriptGroup } from './utils/types';

import { generateStudyNotes, askQuestion, findMostRelevantChunks, generateEmbeddings } from './utils/ai';
import { extractPowerPointContent } from './utils/powerpoint';
import { extractReferences } from './utils/reference';

import { HighlightProvider } from './contexts/HighlightContext';
import { 
  ContentLocation, 
  ContentSource, 
  CombinedContent, 
  VideoItem, 
  Collection, 
  Message,
  ExtractedContent,
  ChunkEmbedding,
  TranscriptResponse,
  AddVideoMethod,
  Content
} from './types';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import { createProject, getProjects, addContent, saveChat, loadChat } from './utils/database';
import { supabase } from './lib/supabase';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import KnowledgebasePage from './pages/KnowledgebasePage';
import NavLink from './components/NavLink';


const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true
});

// HomeButton props interface
interface HomeButtonProps {
  onSelectCollection: Dispatch<SetStateAction<Collection | null>>;
}

// HomeButton component
const HomeButton: React.FC<HomeButtonProps> = ({ onSelectCollection }) => {
  const navigate = useNavigate();
  
  const handleHomeClick = () => {
    // Reset collection selection
    onSelectCollection(null);
    
    // Navigate to home page
    navigate('/');
  };
  
  return (
    <button 
      onClick={handleHomeClick}
      className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900"
    >
      <Home className="w-5 h-5 mr-2" />
      Home
    </button>
  );
};

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [url, setUrl] = useState<string>('');
  const [rawResponse, setRawResponse] = useState<TranscriptResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [durationFilter, setDurationFilter] = useState<number>(30);
  const [videoList, setVideoList] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [generatingNotes, setGeneratingNotes] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [embeddings, setEmbeddings] = useState<ChunkEmbedding[]>([]);
  const [askingQuestion, setAskingQuestion] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState<boolean>(false);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [addVideoMethod, setAddVideoMethod] = useState<AddVideoMethod>('youtube');
  const [addFileMethod, setAddFileMethod] = useState<'file'>('file');
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
  const [extractedText, setExtractedText] = useState<ExtractedContent[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isAddingCollection, setIsAddingCollection] = useState<boolean>(false);
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [newCollectionDescription, setNewCollectionDescription] = useState<string>('');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isProcessingContent, setIsProcessingContent] = useState<boolean>(false);
  const [combinedContent, setCombinedContent] = useState<CombinedContent[]>([]);
  const [chatHistories, setChatHistories] = useState<{ [key: string]: Message[] }>({});
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Update PDF.js worker configuration
  GlobalWorkerOptions.workerSrc = pdfjsWorker;

  const extractVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '0e3GPea1Tyg';
  };

  const formatTime = (seconds: number) => {
    if (typeof seconds !== 'number') return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleAddVideo = async () => {
    if (!url) {
      setError('Please enter a YouTube URL');
      return;
    }

    try {
      setIsProcessingContent(true);
      setLoading(true);
      setError('');
      const videoId = extractVideoId(url);
      
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      let transcriptData;
      if (addVideoMethod === 'youtube_transcript') {
        // Get transcript using our new endpoint
        const apiUrl = process.env.NODE_ENV === 'production' 
          ? '/api/youtube-transcript'  // Production URL
          : 'http://localhost:3000/api/youtube-transcript'; // Development URL
        
        const response = await axios.post(apiUrl, { videoId });
        transcriptData = response.data.transcript;
        
        if (!transcriptData) {
          throw new Error('No transcript data received');
        }

        // Create a new video item for the transcript
        const newVideo: VideoItem = {
          id: `transcript-${Date.now()}`,
          url: url,
          title: `YouTube Transcript - ${url}`,
          type: 'youtube',
          youtube_id: videoId,
          transcript: transcriptData
        };

        // Add to collection
        if (selectedCollection) {
          // Update collections state
          setCollections(prev => prev.map(col => 
            col.id === selectedCollection.id
              ? { ...col, items: [newVideo, ...col.items] }
              : col
          ));

          // Update selected collection state
          const updatedCollection = {
            ...selectedCollection,
            items: [newVideo, ...selectedCollection.items]
          };
          setSelectedCollection(updatedCollection);

          // Update in database
          await handleUpdateProject(selectedCollection.id, selectedCollection.name, selectedCollection.description);
        }

        setSelectedVideo(newVideo);
        setRawResponse({ transcripts: transcriptData });
      } else {
        // Handle regular YouTube video processing
        // ... existing YouTube video processing code ...
      }

      setLoading(false);
      setIsProcessingContent(false);
      setUrl('');
    } catch (error) {
      console.error('Error adding video:', error);
      setError(error instanceof Error ? error.message : 'Failed to add video');
      setLoading(false);
      setIsProcessingContent(false);
    }
  };

  const handleSelectVideo = async (video: VideoItem) => {
    console.log('DEBUG: handleSelectVideo called with:', video);
    try {
      // Don't clear messages when switching files
      setRawResponse(null);
      setExtractedText([]);
      setLoadingTranscript(true);
      setCurrentTimestamp(0);
      setSelectedVideo(video);
      
      // For PDF/text files, set the extracted content immediately
      if (['pdf', 'txt', 'ppt', 'pptx'].includes(video.type)) {
        if (video.extractedContent) {
          console.log('DEBUG: Using cached content:', video.extractedContent);
          setExtractedText(video.extractedContent);
        }
      }

      // For YouTube videos, handle transcript
      if (video.type === 'youtube') {
        if (video.transcript) {
          console.log('DEBUG: Using cached transcript:', video.transcript);
          const transcriptArray = Array.isArray(video.transcript) ? video.transcript : [];
          setRawResponse({ 
            transcripts: transcriptArray.filter(t => t && typeof t.start !== 'undefined')
          });
        }
      }

      // If no cached content, fetch from database
      if (video.id) {
        console.log('DEBUG: Fetching content from database for:', video.id);
        const { data: content, error } = await supabase
          .from('content')
          .select('transcript, content')
          .eq('id', video.id)
          .single();

        if (error) throw error;

        if (content?.transcript && video.type === 'youtube') {
          try {
            const parsedTranscript = JSON.parse(content.transcript);
            console.log('DEBUG: Parsed DB transcript:', parsedTranscript);
            
            const transcriptArray = Array.isArray(parsedTranscript) ? parsedTranscript : [];
            setRawResponse({ 
              transcripts: transcriptArray.filter(t => t && typeof t.start !== 'undefined')
            });
          } catch (e) {
            console.error('DEBUG: Error parsing transcript:', e);
            setRawResponse({ transcripts: [] });
          }
        }

        if (content?.content && ['pdf', 'txt', 'ppt', 'pptx'].includes(video.type)) {
          console.log('DEBUG: Found content in database:', content.content);
          const extractedContent = [{
            text: content.content,
            pageNumber: 1
          }];
          console.log('DEBUG: Setting extracted content:', extractedContent);
          setExtractedText(extractedContent);
          
          // Update video in collections with content
          setCollections(prev => 
            prev.map(col => ({
              ...col,
              items: col.items.map(item => 
                item.id === video.id 
                  ? { 
                      ...item, 
                      content: content.content,
                      extractedContent 
                    }
                  : item
              )
            }))
          );
        } else if (['pdf', 'txt', 'ppt', 'pptx'].includes(video.type)) {
          console.error('DEBUG: No content found in database for file:', video.id);
          setError('Failed to load file content. Please try uploading the file again.');
        }
      }
    } catch (error) {
      console.error('DEBUG: Error loading video content:', error);
      setError('Failed to load video content');
      if (video.type === 'youtube') {
        setRawResponse({ transcripts: [] });
      } else {
        setExtractedText([]);
      }
      throw error;
    } finally {
      setLoadingTranscript(false);
    }
  };

  const handleTranscriptGenerated = async (transcript: TranscriptResponse) => {
    try {
    const newVideo: VideoItem = {
      id: `local-${Date.now()}`,
      url: 'local',
      title: `Uploaded Video ${videoList.length + 1}`,
      type: 'local'
    };

      // Generate embeddings for the transcript
      const embeddingsPromises = transcript.transcripts.map(async (segment: TranscriptSegment) => {
        const embedding = await generateEmbeddings(segment.text);
        return {
          text: segment.text,
          embedding: embedding || []
        };
      });

      const chunkEmbeddings = await Promise.all(embeddingsPromises);

      // Update state
    setVideoList(prevList => [newVideo, ...prevList]);
    setSelectedVideo(newVideo);
      setRawResponse(transcript);
      setEmbeddings(chunkEmbeddings);
      
    } catch (error) {
      console.error('Error processing transcript:', error);
      setError('Failed to process transcript. Please try again.');
    }
  };

  const handleSelectCollection = async (collection: Collection | null) => {
    try {
      // Clear previous collection's state
      setSelectedVideo(null);
      setRawResponse(null);
      setExtractedText([]);
      setQuestion('');
      
      // Set the new collection
      setSelectedCollection(collection);
      
      if (collection) {
        // Always load chat messages from the database
        console.log('Loading chat messages for collection:', collection.id);
        const savedMessages = await loadChat(collection.id);
        console.log('Loaded messages:', savedMessages);
        
        // Update both the current messages and chat histories
        setChatHistories(prev => ({
          ...prev,
          [collection.id]: savedMessages
        }));
        setMessages(savedMessages);
      } else {
        setMessages([]);
        // Clear chat histories for the previous collection
        setChatHistories({});
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
      setMessages([]);
      // Clear chat histories on error
      setChatHistories({});
    }
  };

  const handleAskQuestion = async () => {
    if (!question || !selectedCollection) {
      setError('Please enter a question and select a collection.');
      return;
    }

    setAskingQuestion(true);
    const newUserMessage: Message = { 
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };

    try {
      // Get the current messages from the database first
      const savedMessages = await loadChat(selectedCollection.id);
      const updatedMessages = [...savedMessages, newUserMessage];
      
      // Update messages immediately for UI feedback
      setMessages(updatedMessages);
      setQuestion('');

      // Process the question and get AI response
      const allContent: CombinedContent[] = selectedCollection.items.flatMap(item => {
        if (item.type === 'youtube' && item.transcript) {
          let transcriptArray = Array.isArray(item.transcript) ? item.transcript :
            typeof item.transcript === 'string' ? JSON.parse(item.transcript) : [];
          
          return transcriptArray.map((segment: any) => ({
              text: segment.text,
              source: {
              type: 'youtube' as ContentSource['type'],
              title: item.title || item.url,
                location: {
                  type: 'timestamp',
                value: Math.floor(segment.start)
                }
              }
            }));
          } else if (['pdf', 'txt', 'ppt', 'pptx'].includes(item.type) && item.extractedContent) {
            return item.extractedContent.map((chunk, index) => ({
              text: chunk.text,
              source: {
              type: item.type as ContentSource['type'],
                title: item.title,
                location: {
                type: (item.type === 'pdf' ? 'page' : 'section') as ContentLocation['type'],
                  value: chunk.pageNumber || index + 1
                }
              }
            }));
          }
          return [];
      });

      const relevantContent = await findMostRelevantChunks(question, allContent, 5);
      
      if (relevantContent.length === 0) {
        const noContentMessage: Message = {
          role: 'assistant',
          content: `I couldn't find any relevant information about your question in this knowledge base. Please try asking something related to the available content.`,
          timestamp: new Date().toISOString()
        };
        
        const finalMessages = [...updatedMessages, noContentMessage];
        
        // Update messages state
        setMessages(finalMessages);
        
        // Save to database
        await saveChat(selectedCollection.id, finalMessages);
        return;
      }

      const answer = await askQuestion(question, relevantContent);
      
      const newAssistantMessage: Message = {
        role: 'assistant',
        content: answer,
        references: relevantContent.map(content => ({
          text: content.text,
          source: {
            type: content.source.type,
            title: content.source.title,
            location: content.source.location
          }
        })),
        timestamp: new Date().toISOString()
      };

      // Create final messages array with both user and assistant messages
      const finalMessages = [...updatedMessages, newAssistantMessage];
      
      // Update messages state
      setMessages(finalMessages);

      // Save to database
      await saveChat(selectedCollection.id, finalMessages);

    } catch (error) {
      console.error('Error asking question:', error);
      
      // Handle error by adding error message to this collection's history
      const errorMessage: Message = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Failed to get an answer. Please try again.',
        timestamp: new Date().toISOString()
      };

      // Get the current messages from the database
      const savedMessages = await loadChat(selectedCollection.id);
      const errorMessages = [...savedMessages, newUserMessage, errorMessage];
      
      // Update messages state
      setMessages(errorMessages);

      // Save error state to database
      await saveChat(selectedCollection.id, errorMessages);
    } finally {
      setAskingQuestion(false);
    }
  };

  const fetchTranscript = async (videoUrl: string) => {
    const extractedVideoId = extractVideoId(videoUrl);
    setVideoId(extractedVideoId);
    setLoading(true);
    setLoadingTranscript(true);
    setError('');
    setRawResponse(null);
    setEmbeddings([]);
    setAnswer('');
    setMessages([]);

    try {
      const response = await axios.get('https://www.searchapi.io/api/v1/search', {
        params: {
          engine: 'youtube_transcripts',
          video_id: extractedVideoId,
          api_key: import.meta.env.VITE_SEARCH_API_KEY
        }
      });

      setRawResponse(response.data);

      const chunks = groupTranscriptsByDuration(response.data.transcripts);
      const embeddingsPromises = chunks.map(async (chunk) => {
        const embedding = await generateEmbeddings(chunk.text);
        return {
          text: chunk.text,
          embedding: embedding || []
        };
      });

      const chunkEmbeddings = await Promise.all(embeddingsPromises);
      setEmbeddings(chunkEmbeddings);

    } catch (err: any) {
      console.error('API Error:', err.response?.data || err.message);
      if (axios.isAxiosError(err)) {
        setError(`API Error: ${err.response?.data?.message || err.message}`);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingTranscript(false);
    }
  };

  const groupTranscriptsByDuration = (transcripts: any[], duration: number = 30): any[] => {
    if (!Array.isArray(transcripts) || transcripts.length === 0) {
      console.log('No transcripts to group');
      return [];
    }

    console.log('Grouping transcripts with duration:', duration);
    console.log('Input transcripts:', transcripts);

    const groups = [];
    let currentGroup = {
      start: transcripts[0].start,
      duration: duration,
      text: '',
      texts: [] as string[]
    };

    for (const segment of transcripts) {
      if (!segment || typeof segment.start !== 'number') {
        console.log('Invalid segment:', segment);
        continue;
      }

      const segmentStart = Number(segment.start);
      const groupEnd = currentGroup.start + duration;

      if (segmentStart <= groupEnd) {
        // Add to current group
        currentGroup.texts.push(segment.text);
      } else {
        // Finalize current group
        if (currentGroup.texts.length > 0) {
          groups.push({
            start: currentGroup.start,
            duration: duration,
            text: currentGroup.texts.join(' '),
            startTime: currentGroup.start,
            endTime: currentGroup.start + duration
          });
        }

        // Start new group
        currentGroup = {
          start: segmentStart,
          duration: duration,
          text: '',
          texts: [segment.text]
        };
      }
    }

    // Add the last group if it has content
    if (currentGroup.texts.length > 0) {
      groups.push({
        start: currentGroup.start,
        duration: duration,
        text: currentGroup.texts.join(' '),
        startTime: currentGroup.start,
        endTime: currentGroup.start + duration
      });
    }

    console.log('Grouped transcripts:', groups);
    return groups;
  };

  const calculateTotalDuration = (transcripts: any[]): number => {
    if (!Array.isArray(transcripts)) {
      console.warn('Transcripts is not an array:', transcripts);
      return 0;
    }
    
    return transcripts.reduce((total, segment) => {
      const duration = segment.duration || 0;
      return total + duration;
    }, 0);
  };

  const formatDurationLabel = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (minutes === 0) {
      return `${remainingSeconds} seconds`;
    } else if (minutes === 1) {
      return `${minutes} minute ${remainingSeconds} seconds`;
    } else {
      return `${minutes} minutes ${remainingSeconds} seconds`;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCollection) return;

    try {
      setIsProcessingContent(true);
      setError('');
      let fileType = file.name.split('.').pop()?.toLowerCase() as Content['type'];

      // Create optimistic update with a temporary ID
      const optimisticId = 'temp-' + Date.now();
      const tempItem: VideoItem = {
        id: optimisticId,
        url: URL.createObjectURL(file),
        title: file.name,
        type: fileType,
        extractedContent: [{
          text: 'Processing content...',
          pageNumber: 1
        }]
      };

      // Add temporary item to collections
      setCollections(prev => {
        const updatedCollections = prev.map(col => 
          col.id === selectedCollection.id
            ? { ...col, items: [...col.items, tempItem] }
            : col
        );
        return updatedCollections;
      });

      // Process the content
      const processedContent = await (async () => {
        if (fileType === 'pdf') {
          const pdfData = await file.arrayBuffer();
          const pdf = await getDocument(pdfData).promise;
          const numPages = pdf.numPages;
          const textContent = [];
          
          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            textContent.push(content.items.map((item: any) => item.str).join(' '));
          }
          
          return textContent.join('\n');
        } else if (fileType === 'txt') {
          return await file.text();
        } else if (['ppt', 'pptx'].includes(fileType)) {
          const slides = await extractPowerPointContent(file);
          return slides.map(slide => slide.text).join('\n\n');
        } else if (['doc', 'docx'].includes(fileType)) {
          return await file.text();
        }
        return '';
      })();

      // Save to database
      const content = await addContent(selectedCollection.id, {
        title: file.name,
        type: fileType,
        content: processedContent,
        url: file.name
      });

      // Create the final item
      const newItem: VideoItem = {
        id: content.id,
        url: file.name,
        title: file.name,
        type: fileType,
        content: processedContent,
        extractedContent: [{
          text: processedContent,
          pageNumber: 1
        }]
      };

      // Update collections state with the real item
      setCollections(prev => {
        const updatedCollections = prev.map(col => 
          col.id === selectedCollection.id
            ? { 
                ...col, 
                items: col.items
                  .filter(item => item.id !== optimisticId)
                  .concat([newItem])
              }
            : col
        );
        return updatedCollections;
      });

      // Set as selected video if none is selected
      if (!selectedVideo) {
        setSelectedVideo(newItem);
      }

      // Show success toast
      setToast({
        message: 'Content added successfully',
        type: 'success'
      });

      // Clear the file input
      event.target.value = '';

    } catch (error) {
      console.error('Error processing file:', error);
      setError('Failed to process file. Please try again.');
      
      // Remove temporary item on error
      setCollections(prev => prev.map(col => 
        col.id === selectedCollection.id
          ? { 
              ...col, 
              items: col.items.filter(item => !item.id.startsWith('temp-'))
            }
          : col
      ));

      setToast({
        message: 'Failed to add content',
        type: 'error'
      });
    } finally {
      setIsProcessingContent(false);
    }
  };

  const handleTextSubmit = async (text: string) => {
    if (!text || !selectedCollection) return;

    try {
      setIsProcessingContent(true);
      
      // Parse the text content
      let contentType: VideoItem['type'] = 'txt';
      let contentText = text;
      let contentTitle = 'Text Note';
      
      // Create optimistic ID
      const optimisticId = `temp-${Date.now()}`;
      
      // Create temporary item for optimistic update
      const tempItem: VideoItem = {
        id: optimisticId,
        url: 'text-input',
        title: contentTitle,
        type: contentType,
        extractedContent: [{
          text: contentText,
          pageNumber: 1
        }]
      };
      
      // Add to database with required title
      const content = await addContent(selectedCollection.id, {
        type: contentType,
        content: contentText,
        url: 'text-input',
        title: contentTitle
      });
      
      // Create the final item
      const newItem: VideoItem = {
        id: content.id,
        url: 'text-input',
        title: contentTitle,
        type: contentType,
        content: contentText,
        extractedContent: [{
          text: contentText,
          pageNumber: 1
        }]
      };
      
      // Update collections with the final item
      setCollections(prev => {
        const updatedCollections = prev.map(col => 
          col.id === selectedCollection.id
            ? { ...col, items: [...col.items.filter(i => i.id !== optimisticId), newItem] }
            : col
        );
        return updatedCollections;
      });
      
      // Show success toast
      setToast({
        message: 'Content added successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error adding content:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add content';
      setError(errorMessage);
      
      // Show error toast
      setToast({
        message: `Failed to add content: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setIsProcessingContent(false);
    }
  };

  const processExtractedText = (text: string) => {
    const chunks = createChunksFromText(text);
    setExtractedText(chunks);
    updateContext();
  };

  const createChunksFromText = (text: string): ExtractedContent[] => {
    // Strip any HTML tags that might have made it through
    const plainText = text.replace(/<[^>]*>/g, '');
    const sentences = plainText.split('. ');
    return sentences.map((sentence, index) => ({
      text: sentence,
      pageNumber: index + 1
    }));
  };

  const updateContext = () => {
    if (!rawResponse?.transcripts) return;

    const combinedContext: ChunkEmbedding[] = [
      ...rawResponse.transcripts.map((segment: TranscriptSegment) => ({
        text: segment.text,
        embedding: [] // Initialize with empty embedding
      })),
      ...extractedText.map(chunk => ({
        text: chunk.text,
        embedding: [] // Initialize with empty embedding
      })),
    ];
    setEmbeddings(combinedContext);
  };

  const createCollection = async () => {
    try {
      await handleCreateProject(newCollectionName, newCollectionDescription);
      setNewCollectionName('');
      setNewCollectionDescription('');
      setIsAddingCollection(false);
      setIsProjectModalOpen(false);
    } catch (error) {
      console.error('Error creating collection:', error);
      setError('Failed to create collection');
    }
  };

  const addToCollection = (videoId: string, collectionId: string) => {
    setVideoList(prev => prev.map(video => 
      video.id === videoId 
        ? { ...video, collectionId } 
        : video
    ));
    
    setCollections(prev => prev.map(collection => 
      collection.id === collectionId 
        ? { ...collection, items: [...collection.items, videoList.find(v => v.id === videoId)!] }
        : collection
    ));
  };

  // Update useEffect to combine content when collection changes
  useEffect(() => {
    if (selectedCollection) {
      const allContent: CombinedContent[] = [];
      
      selectedCollection.items.forEach(item => {
        if (item.type === 'youtube' && rawResponse?.transcripts) {
          rawResponse.transcripts.forEach((segment: TranscriptSegment) => {
            if (segment.text && segment.text.trim()) {
              allContent.push({
                text: segment.text,
                source: {
                  type: 'youtube' as const,
                  title: item.title || item.url,
                  location: {
                    type: 'timestamp',
                    value: Math.floor(segment.start)
                  }
                }
              });
            }
          });
        } else if (['pdf', 'txt', 'ppt', 'pptx'].includes(item.type) && item.extractedContent) {
          item.extractedContent.forEach(chunk => {
            if (chunk.text && chunk.text.trim()) {
              const locationType = item.type === 'pdf' ? 'page' :
                                 item.type === 'txt' ? 'section' : 'slide';
              
              allContent.push({
                text: chunk.text,
                source: {
                  type: item.type === 'pdf' ? 'pdf' :
                        item.type === 'ppt' || item.type === 'pptx' ? 'pptx' :
                        item.type === 'txt' ? 'txt' : 'txt' as ContentSource['type'],
                  title: item.title,
                  location: {
                    type: locationType,
                    value: item.type === 'txt' ? (chunk.index || 0) + 1 : (chunk.pageNumber || chunk.index || 0)
                  }
                }
              });
            }
          });
        }
      });
      
      setCombinedContent(allContent);
    }
  }, [selectedCollection, rawResponse, formatTime]);

  // Single useEffect for loading collections
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user || authLoading) return;
      
      try {
        const [projects, { data: allContent }] = await Promise.all([
          getProjects(),
          supabase.from('content').select('*')
        ]);

        const contentMap = new Map();
        allContent?.forEach(content => {
          if (!contentMap.has(content.project_id)) {
            contentMap.set(content.project_id, []);
          }
          contentMap.get(content.project_id).push({
            id: content.id,
            url: content.url || '',
            title: content.title,
            type: content.type,
            transcript: content.transcript ? JSON.parse(content.transcript) : [],
            extractedContent: content.content ? [{
              text: content.content,
              pageNumber: 1
            }] : [],
            youtube_id: content.youtube_id,
            content: content.content
          });
        });

        const collectionsWithContent = projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
          items: contentMap.get(project.id) || [],
        createdAt: new Date(project.created_at)
        }));

        setCollections(collectionsWithContent);
    } catch (error) {
      setError('Failed to load projects');
    }
  };

    loadInitialData();
  }, [user, authLoading]);

  const handleCreateProject = async (name: string, description?: string) => {
    try {
      const newProject = await createProject(name, description);
      setCollections(prev => [...prev, {
        id: newProject.id,
        name: newProject.name,
        description: newProject.description,
        items: [],
        createdAt: new Date(newProject.created_at)
      }]);
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  // Add these functions
  const handleUpdateProject = async (id: string, name: string, description?: string) => {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .update({ name, description })
        .eq('id', id)
        .single();

      if (error) throw error;

      setCollections(prev => prev.map(col => 
        col.id === id 
          ? { ...col, name, description }
          : col
      ));
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCollections(prev => prev.filter(col => col.id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  };

  const handleDeleteContent = async (collectionId: string, contentId: string) => {
    try {
      // Delete from database first
      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', contentId);

      if (error) throw error;

      // Update UI state
      setCollections(prevCollections => {
        const newCollections = prevCollections.map(collection => {
          if (collection.id === collectionId) {
            return {
              ...collection,
              items: collection.items.filter(item => item.id !== contentId)
            };
          }
          return collection;
        });
        return newCollections;
      });

      // Clear selection if the deleted item was selected
      if (selectedVideo?.id === contentId) {
        setSelectedVideo(null);
        setExtractedText([]);
      }

      // Show success toast
      setToast({
        message: 'Content deleted successfully',
        type: 'success'
      });

    } catch (error) {
      console.error('Error deleting content:', error);
      setError('Failed to delete content. Please try again.');
      setToast({
        message: 'Failed to delete content',
        type: 'error'
      });
    }
  };

  // Add function to handle reference clicks
  const handleReferenceClick = (source: ContentSource) => {
    console.log('DEBUG: App handleReferenceClick called with:', source);
    
    // Find the video in the collection
    const video = selectedCollection?.items.find(item => {
      if (item.type !== source.type) return false;
      
      // For YouTube videos, match by URL or title
      if (item.type === 'youtube') {
        const sourceTitle = source.title.toLowerCase();
        const itemTitle = (item.title || '').toLowerCase();
        const itemUrl = (item.url || '').toLowerCase();
        const videoId = item.youtube_id || extractVideoId(item.url);
        
        return itemUrl === sourceTitle || 
               itemTitle === sourceTitle ||
               sourceTitle.includes(videoId);
      }
      
      // For other types, match by title
      return item.title === source.title;
    });
    
    console.log('DEBUG: Found matching video:', video);
    
    if (video) {
      // If it's the same video, just seek to the timestamp
      if (selectedVideo?.id === video.id) {
        if (source.location?.type === 'timestamp') {
          const timestampStr = source.location.value.toString();
          let totalSeconds: number;
          
          // Handle MM:SS format
          if (typeof timestampStr === 'string' && timestampStr.includes(':')) {
            const [minutes, seconds] = timestampStr.split(':').map(Number);
            totalSeconds = (minutes * 60) + seconds;
          } else {
            totalSeconds = parseInt(timestampStr);
          }
          
          if (!isNaN(totalSeconds)) {
            console.log('DEBUG: Setting timestamp:', totalSeconds);
            // Add a longer delay to ensure the video is loaded
            setTimeout(() => {
              setCurrentTimestamp(totalSeconds);
            }, 2000);
          }
        }
      } else {
        // First set the selected video
        setSelectedVideo(video);
        
        // Then handle the video selection
        handleSelectVideo(video).then(() => {
          // After video is selected and loaded, handle timestamp if present
          if (source.location?.type === 'timestamp') {
            const timestampStr = source.location.value.toString();
            let totalSeconds: number;
            
            // Handle MM:SS format
            if (typeof timestampStr === 'string' && timestampStr.includes(':')) {
              const [minutes, seconds] = timestampStr.split(':').map(Number);
              totalSeconds = (minutes * 60) + seconds;
            } else {
              totalSeconds = parseInt(timestampStr);
            }
            
            if (!isNaN(totalSeconds)) {
              console.log('DEBUG: Setting timestamp:', totalSeconds);
              // Add a longer delay to ensure the video is loaded
              setTimeout(() => {
                setCurrentTimestamp(totalSeconds);
              }, 2000);
            }
          }
        }).catch(error => {
          console.error('DEBUG: Error handling video selection:', error);
        });
      }
    } else {
      console.error('DEBUG: No matching video found for:', source);
    }
  };

  const handleGenerateNotes = async () => {
    if (!selectedCollection) return;
    
    setGeneratingNotes(true);
    try {
      // Combine all content from the collection
      const allContent: CombinedContent[] = selectedCollection.items.flatMap(item => {
        if (item.type === 'youtube' && item.transcript) {
          const transcriptArray = Array.isArray(item.transcript) 
            ? item.transcript 
            : typeof item.transcript === 'string' 
              ? JSON.parse(item.transcript) 
              : [];
          
          return transcriptArray.map((segment: any) => ({
            text: segment.text,
            source: {
              type: 'youtube' as ContentSource['type'],
              title: item.title || item.url,
              location: {
                type: 'timestamp',
                value: Math.floor(segment.start)
              }
            }
          }));
        } else if (['pdf', 'txt', 'ppt', 'pptx'].includes(item.type) && item.content) {
          return [{
            text: item.content,
            source: {
              type: item.type as ContentSource['type'],
              title: item.title,
              location: {
                type: item.type === 'pdf' ? 'page' : 'section',
                value: 1
              }
            }
          }];
        }
        return [];
      });

      if (allContent.length === 0) {
        throw new Error('No content available to generate notes from');
      }

      const notes = await generateStudyNotes(
        allContent.map(content => content.text).join('\n\n'),
        allContent
      );

      // Extract references from the generated notes
      const { text, references } = extractReferences(notes);
      
      // Create a new message for the study notes
      const studyNotesMessage: Message = {
        role: 'assistant',
        content: text,
        references: references,
        timestamp: new Date().toISOString(),
        isStudyNotes: true
      };

      // Update messages state with the new study notes
      const updatedMessages = [...messages, studyNotesMessage];
      setMessages(updatedMessages);

      // Save to chat database
      await saveChat(selectedCollection.id, updatedMessages);
    } catch (error) {
      console.error('Error generating study notes:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: error instanceof Error 
          ? `Failed to generate study notes: ${error.message}`
          : 'Failed to generate study notes. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages([...messages, errorMessage]);
    } finally {
      setGeneratingNotes(false);
    }
  };

  // Add a useEffect to handle chat history when switching collections
  useEffect(() => {
    if (selectedCollection) {
      // Set the messages to the selected collection's history
      setMessages(chatHistories[selectedCollection.id] || []);
    } else {
      setMessages([]);
    }
  }, [selectedCollection?.id, chatHistories]);

  // Add the updateVideoItem function
  const updateVideoItem = async (id: string, item: VideoItem) => {
    try {
      // Update the item in the database
      // This is a placeholder - implement the actual database update
      console.log('Updating video item:', id, item);
      return true;
    } catch (error) {
      console.error('Error updating video item:', error);
      return false;
    }
  };

  // Add effect to auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (authLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <HighlightProvider>
        <div className="min-h-screen bg-gray-50">
          {/* Toast component */}
          {toast && (
            <div className={`fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white transform transition-transform duration-300 ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              {toast.message}
            </div>
          )}
          
          {/* Navigation */}
          <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <HomeButton 
                    onSelectCollection={setSelectedCollection}
                  />
                  <Link 
                    to="/knowledgebase"
                    onClick={() => {
                      setSelectedCollection(null);
                      setSelectedVideo(null);
                      setMessages([]);
                    }}
                    className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Knowledgebase
                  </Link>
                </div>
                <div className="flex items-center">
                  <UserCircle className="w-6 h-6 text-gray-600" />
                  <button
                    onClick={signOut}
                    className="ml-4 text-gray-600 hover:text-gray-900"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </nav>

          {/* Main content */}
          <main className="max-w-7xl mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route 
                path="/knowledgebase" 
                element={
                  <KnowledgebasePage
                    collections={collections}
                    selectedCollection={selectedCollection}
                    onSelectCollection={setSelectedCollection}
                    onCreateProject={handleCreateProject}
                    onUpdateProject={handleUpdateProject}
                    onDeleteProject={handleDeleteProject}
                    onDeleteContent={handleDeleteContent}
                    selectedVideo={selectedVideo}
                    rawResponse={rawResponse}
                    loadingTranscript={loadingTranscript}
                    extractedText={extractedText}
                    currentTimestamp={currentTimestamp}
                    onSeek={setCurrentTimestamp}
                    onVideoSelect={handleSelectVideo}
                    durationFilter={durationFilter}
                    onDurationFilterChange={setDurationFilter}
                    formatTime={formatTime}
                    groupTranscriptsByDuration={groupTranscriptsByDuration}
                    calculateTotalDuration={calculateTotalDuration}
                    formatDurationLabel={formatDurationLabel}
                    messages={messages}
                    question={question}
                    askingQuestion={askingQuestion}
                    onQuestionChange={setQuestion}
                    onAskQuestion={handleAskQuestion}
                    onReferenceClick={handleReferenceClick}
                    onGenerateNotes={handleGenerateNotes}
                    generatingNotes={generatingNotes}
                    addVideoMethod={addVideoMethod}
                    setAddVideoMethod={setAddVideoMethod}
                    url={url}
                    setUrl={setUrl}
                    onAddVideo={handleAddVideo}
                    onTranscriptGenerated={handleTranscriptGenerated}
                    onError={setError}
                    onFileSelect={handleFileSelect}
                    isProcessingContent={isProcessingContent}
                    loadChat={loadChat}
                    setMessages={setMessages}
                  />
                } 
              />
              <Route 
                path="/knowledgebase/:id" 
                element={
                  <KnowledgebasePage
                    collections={collections}
                    selectedCollection={selectedCollection}
                    onSelectCollection={setSelectedCollection}
                    onCreateProject={handleCreateProject}
                    onUpdateProject={handleUpdateProject}
                    onDeleteProject={handleDeleteProject}
                    onDeleteContent={handleDeleteContent}
                    selectedVideo={selectedVideo}
                    rawResponse={rawResponse}
                    loadingTranscript={loadingTranscript}
                    extractedText={extractedText}
                    currentTimestamp={currentTimestamp}
                    onSeek={setCurrentTimestamp}
                    onVideoSelect={handleSelectVideo}
                    durationFilter={durationFilter}
                    onDurationFilterChange={setDurationFilter}
                    formatTime={formatTime}
                    groupTranscriptsByDuration={groupTranscriptsByDuration}
                    calculateTotalDuration={calculateTotalDuration}
                    formatDurationLabel={formatDurationLabel}
                    messages={messages}
                    question={question}
                    askingQuestion={askingQuestion}
                    onQuestionChange={setQuestion}
                    onAskQuestion={handleAskQuestion}
                    onReferenceClick={handleReferenceClick}
                    onGenerateNotes={handleGenerateNotes}
                    generatingNotes={generatingNotes}
                    addVideoMethod={addVideoMethod}
                    setAddVideoMethod={setAddVideoMethod}
                    url={url}
                    setUrl={setUrl}
                    onAddVideo={handleAddVideo}
                    onTranscriptGenerated={handleTranscriptGenerated}
                    onError={setError}
                    onFileSelect={handleFileSelect}
                    isProcessingContent={isProcessingContent}
                    loadChat={loadChat}
                    setMessages={setMessages}
                  />
                } 
              />
              <Route 
                path="/knowledgebase/:id/:mode" 
                element={
                  <KnowledgebasePage
                    collections={collections}
                    selectedCollection={selectedCollection}
                    onSelectCollection={setSelectedCollection}
                    onCreateProject={handleCreateProject}
                    onUpdateProject={handleUpdateProject}
                    onDeleteProject={handleDeleteProject}
                    onDeleteContent={handleDeleteContent}
                    selectedVideo={selectedVideo}
                    rawResponse={rawResponse}
                    loadingTranscript={loadingTranscript}
                    extractedText={extractedText}
                    currentTimestamp={currentTimestamp}
                    onSeek={setCurrentTimestamp}
                    onVideoSelect={handleSelectVideo}
                    durationFilter={durationFilter}
                    onDurationFilterChange={setDurationFilter}
                    formatTime={formatTime}
                    groupTranscriptsByDuration={groupTranscriptsByDuration}
                    calculateTotalDuration={calculateTotalDuration}
                    formatDurationLabel={formatDurationLabel}
                    messages={messages}
                    question={question}
                    askingQuestion={askingQuestion}
                    onQuestionChange={setQuestion}
                    onAskQuestion={handleAskQuestion}
                    onReferenceClick={handleReferenceClick}
                    onGenerateNotes={handleGenerateNotes}
                    generatingNotes={generatingNotes}
                    addVideoMethod={addVideoMethod}
                    setAddVideoMethod={setAddVideoMethod}
                    url={url}
                    setUrl={setUrl}
                    onAddVideo={handleAddVideo}
                    onTranscriptGenerated={handleTranscriptGenerated}
                    onError={setError}
                    onFileSelect={handleFileSelect}
                    isProcessingContent={isProcessingContent}
                    loadChat={loadChat}
                    setMessages={setMessages}
                  />
                } 
              />
            </Routes>
          </main>
        </div>
      </HighlightProvider>
    </Router>
  );
}

export default App;