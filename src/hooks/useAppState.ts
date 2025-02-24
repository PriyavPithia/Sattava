import { useState } from 'react';
import { 
  VideoItem, 
  Collection, 
  Message, 
  ExtractedContent,
  CombinedContent,
  TranscriptResponse
} from '../types';
import { ChunkEmbedding } from '../types/embedding';
import { loadChat } from '../utils/database';

export const useAppState = () => {
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

  return {
    url,
    setUrl,
    rawResponse,
    setRawResponse,
    loading,
    setLoading,
    error,
    setError,
    videoId,
    setVideoId,
    durationFilter,
    setDurationFilter,
    videoList,
    setVideoList,
    selectedVideo,
    setSelectedVideo,
    studyNotes,
    setStudyNotes,
    generatingNotes,
    setGeneratingNotes,
    question,
    setQuestion,
    answer,
    setAnswer,
    embeddings,
    setEmbeddings,
    askingQuestion,
    setAskingQuestion,
    messages,
    setMessages,
    loadingTranscript,
    setLoadingTranscript,
    loadingNotes,
    setLoadingNotes,
    addVideoMethod,
    setAddVideoMethod,
    addFileMethod,
    setAddFileMethod,
    currentTimestamp,
    setCurrentTimestamp,
    extractedText,
    setExtractedText,
    collections,
    setCollections,
    selectedCollection,
    setSelectedCollection,
    isAddingCollection,
    setIsAddingCollection,
    newCollectionName,
    setNewCollectionName,
    newCollectionDescription,
    setNewCollectionDescription,
    isProjectModalOpen,
    setIsProjectModalOpen,
    isProcessingContent,
    setIsProcessingContent,
    combinedContent,
    setCombinedContent,
    handleSelectCollection
  };
}; 