import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Plus, Home, Upload, UserCircle, LogOut } from 'lucide-react';
import OpenAI from 'openai';

import { getDocument } from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

import { TranscriptSegment, TranscriptGroup } from './utils/types';

import { generateStudyNotes, askQuestion, findMostRelevantChunks, generateEmbeddings } from './utils/ai';
import { extractPowerPointContent } from './utils/powerpoint';

import { HighlightProvider } from './contexts/HighlightContext';
import { 
  ContentLocation, 
  ContentSource, 
  CombinedContent, 
  VideoItem, 
  Collection, 
  Message,
  ExtractedContent 
} from './types';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import { createProject, getProjects, addContent, saveChat, loadChat } from './utils/database';
import { supabase } from './lib/supabase';
import { Content } from './types/database';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import TranscriptionsPage from './pages/TranscriptionsPage';
import NavLink from './components/NavLink';


const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true
});

interface ChunkEmbedding {
  text: string;
  embedding: number[];
}

interface TranscriptResponse {
  transcripts: TranscriptSegment[];
}

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
  const [studyNotes, setStudyNotes] = useState<string>('');
  const [generatingNotes, setGeneratingNotes] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [embeddings, setEmbeddings] = useState<ChunkEmbedding[]>([]);
  const [askingQuestion, setAskingQuestion] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState<boolean>(false);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [addVideoMethod, setAddVideoMethod] = useState<'youtube' | 'upload' | 'file'>('youtube');
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
      
      // Get transcript first
      const response = await axios.get('https://www.searchapi.io/api/v1/search', {
        params: {
          engine: 'youtube_transcripts',
          video_id: videoId,
          api_key: import.meta.env.VITE_SEARCH_API_KEY
        }
      });

      // Create a new collection if none is selected
      let targetCollection = selectedCollection;
      if (!targetCollection) {
        const newProject = await createProject('My Collection');
        const newCollection: Collection = {
          id: newProject.id,
          name: newProject.name,
          items: [],
          createdAt: new Date(newProject.created_at)
        };
        targetCollection = newCollection;
        setSelectedCollection(newCollection);
        setCollections(prev => [...prev, newCollection]);
      }

      // Add to database with transcript
      const content = await addContent(targetCollection.id, {
        title: url,
        type: 'youtube',
        url: url,
        youtube_id: videoId,
        transcript: JSON.stringify(response.data.transcripts)
      });

      // Create the new video item
      const newVideo: VideoItem = {
        id: content.id,
        url,
        title: url,
        type: 'youtube',
        transcript: response.data.transcripts
      };

      // Update collections
      setCollections(prev => prev.map(col => 
        col.id === targetCollection!.id
          ? { ...col, items: [...col.items, newVideo] }
          : col
      ));

      setUrl('');
      setError('');
    } catch (error) {
      console.error('Error adding video:', error);
      setError('Failed to add video. Please try again.');
    } finally {
      setLoading(false);
      setIsProcessingContent(false);
    }
  };

  const handleSelectVideo = async (video: VideoItem) => {
    console.log('DEBUG: handleSelectVideo called with:', video);
    try {
      // Clear previous state
      setRawResponse(null);
      setExtractedText([]);
      setLoadingTranscript(true);
      
      // Reset timestamp and highlighting when initially viewing content
      setCurrentTimestamp(0);
      
      // Set the selected video immediately
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

  const handleGenerateStudyNotes = async () => {
    if (!rawResponse?.transcripts) return;
    
    setGeneratingNotes(true);
    setLoadingNotes(true);
    const contentText = rawResponse.transcripts
      .map((segment: any) => segment.text)
      .join(' ');

    try {
      const notes = await generateStudyNotes(contentText);
      setStudyNotes(notes);
    } catch (error) {
      console.error('Error generating notes:', error);
      setStudyNotes('Failed to generate study notes. Please try again.');
    } finally {
      setGeneratingNotes(false);
      setLoadingNotes(false);
    }
  };

  const handleSelectCollection = async (collection: Collection | null) => {
    // Clear previous collection's state
    setSelectedVideo(null);
    setRawResponse(null);
    setExtractedText([]);
    setQuestion('');
    setMessages([]);
    
    // Set the new collection
    setSelectedCollection(collection);
    
    if (collection) {
      try {
        // Load existing chat messages for this collection
        const savedMessages = await loadChat(collection.id);
        setMessages(savedMessages);
      } catch (error) {
        console.error('Error loading chat messages:', error);
        setMessages([]);
      }
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
      const updatedMessages = [...messages, newUserMessage];
      setMessages(updatedMessages);
      setQuestion('');

      await saveChat(selectedCollection.id, updatedMessages);

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

      if (allContent.length === 0) {
        throw new Error('No content available in this knowledge base to answer questions.');
      }

      const relevantContent = await findMostRelevantChunks(question, allContent, 5);
      
      if (relevantContent.length === 0) {
        const noContentMessage: Message = {
          role: 'assistant',
          content: `I couldn't find any relevant information about your question in this knowledge base. Please try asking something related to the available content.`,
          timestamp: new Date().toISOString()
        };
        
        const finalMessages = [...updatedMessages, noContentMessage];
        setMessages(finalMessages);
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

      const finalMessages = [...updatedMessages, newAssistantMessage];
      setMessages(finalMessages);
      await saveChat(selectedCollection.id, finalMessages);

    } catch (error) {
      console.error('Error asking question:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'I encountered an error while processing your question. Please try again.',
        timestamp: new Date().toISOString()
      };

      const errorMessages = [...messages, newUserMessage, errorMessage];
      setMessages(errorMessages);
      
      if (selectedCollection) {
        await saveChat(selectedCollection.id, errorMessages).catch(saveError => {
          console.error('Error saving error state:', saveError);
        });
      }
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
    setStudyNotes('');
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
      let extractedContent = '';
      let fileType = file.name.split('.').pop()?.toLowerCase() as Content['type'];

      // Create optimistic update
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

      // Optimistic update
      setCollections(prev => prev.map(col => 
        col.id === selectedCollection.id
          ? { ...col, items: [...col.items, tempItem] }
          : col
      ));

      // Process content in background
      const processContent = async () => {
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
        }
        return '';
      };

      // Process content first
      const processedContent = await processContent();

      // Then save to database with the processed content
      const content = await addContent(selectedCollection.id, {
        title: file.name,
        type: fileType,
        content: processedContent, // Save the processed content
        url: file.name // Just use the filename as URL
      });

      // Update with real content
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

      // Update collections with real item
      setCollections(prev => prev.map(col => 
        col.id === selectedCollection.id
          ? { 
              ...col, 
              items: col.items
                .filter(item => item.id !== optimisticId)
                .concat(newItem)
            }
          : col
      ));

      if (!selectedVideo) {
        setSelectedVideo(newItem);
      }

      // Clear input
      if (event.target.value) {
        event.target.value = '';
      }

    } catch (error) {
      console.error('Error processing file:', error);
      setError('Failed to process file. Please try again.');
      
      // Remove temporary item
      setCollections(prev => prev.map(col => 
        col.id === selectedCollection.id
          ? { 
              ...col, 
              items: col.items.filter(item => !item.id.startsWith('temp-'))
            }
          : col
      ));
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
    const sentences = text.split('. ');
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
      // Store item for potential rollback
      const itemToDelete = collections
        .find(col => col.id === collectionId)
        ?.items.find(item => item.id === contentId);
      
      // Optimistic update
      setCollections(prev => prev.map(col => 
        col.id === collectionId
          ? { ...col, items: col.items.filter(item => item.id !== contentId) }
          : col
      ));

      // Clear selection if needed
      if (selectedVideo?.id === contentId) {
        setSelectedVideo(null);
        setExtractedText([]);
      }

      // Delete in background
      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', contentId);

      if (error) {
        // Rollback on error
        if (itemToDelete) {
          setCollections(prev => prev.map(col => 
            col.id === collectionId
              ? { ...col, items: [...col.items, itemToDelete] }
              : col
          ));
        }
        throw error;
      }

    } catch (error) {
      console.error('Error deleting content:', error);
      setError('Failed to delete content. Please try again.');
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

  // Update the loading check to use authLoading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <HighlightProvider>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
            <div className="p-4 border-b border-gray-200">
              <h1 className="text-xl font-semibold">Sattva AI</h1>
            </div>
            
            <nav className="flex-1 p-4 space-y-2">
              <NavLink to="/" icon={Home}>Home</NavLink>
              <NavLink to="/upload" icon={Upload}>Knowledgebases</NavLink>
              <NavLink to="/transcriptions" icon={FileText}>Transcriptions</NavLink>
            </nav>

            {/* User Profile Section */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center space-x-3 mb-3">
                <UserCircle className="w-8 h-8 text-gray-600" />
                <div className="flex-1 truncate">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>

            
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route 
                path="/upload" 
                element={
                  <UploadPage 
                    addVideoMethod={addVideoMethod}
                    setAddVideoMethod={setAddVideoMethod}
                    url={url}
                    setUrl={setUrl}
                    onAddVideo={handleAddVideo}
                    onTranscriptGenerated={handleTranscriptGenerated}
                    onError={setError}
                    onFileSelect={handleFileSelect}
                    isProcessingContent={isProcessingContent}
                    collections={collections}
                    selectedCollection={selectedCollection}
                    onSelectCollection={handleSelectCollection}
                    onCreateProject={handleCreateProject}
                    onUpdateProject={handleUpdateProject}
                    onDeleteProject={handleDeleteProject}
                    onDeleteContent={handleDeleteContent}
                  />
                } 
              />
              <Route 
                path="/transcriptions" 
                element={
                  <TranscriptionsPage 
                    collections={collections}
                    selectedCollection={selectedCollection}
                    onSelectCollection={handleSelectCollection}
                    selectedVideo={selectedVideo}
                    rawResponse={rawResponse}
                    messages={messages}
                    question={question}
                    askingQuestion={askingQuestion}
                    onQuestionChange={setQuestion}
                    onAskQuestion={handleAskQuestion}
                    durationFilter={durationFilter}
                    onDurationFilterChange={setDurationFilter}
                    onSeek={(timestamp) => {
                      console.log('DEBUG: Setting timestamp:', timestamp);
                      setCurrentTimestamp(timestamp);
                    }}
                    loadingTranscript={loadingTranscript}
                    extractedText={extractedText}
                    formatTime={formatTime}
                    groupTranscriptsByDuration={groupTranscriptsByDuration}
                    calculateTotalDuration={calculateTotalDuration}
                    formatDurationLabel={formatDurationLabel}
                    currentTimestamp={currentTimestamp}
                    onReferenceClick={(source) => {
                      console.log('DEBUG: Reference click in App:', source);
                      handleReferenceClick(source);
                    }}
                    onTranscriptLoad={(data) => {
                      console.log('DEBUG: Loading transcript:', data);
                      setRawResponse(data);
                    }}
                    onVideoSelect={(video) => {
                      console.log('DEBUG: Video selection in App:', video);
                      setSelectedVideo(video);
                      handleSelectVideo(video);
                    }}
                  />
                } 
              />
            </Routes>
          </div>
        </div>
      </HighlightProvider>
    </Router>
  );
}

export default App;