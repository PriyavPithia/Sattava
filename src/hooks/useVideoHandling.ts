import { useState } from 'react';
import axios from 'axios';
import { VideoItem, Collection } from '../types';
import { TranscriptResponse } from '../types/embedding';
import { addContent } from '../utils/database';
import { generateEmbeddings } from '../utils/ai';

export const useVideoHandling = (
  selectedCollection: Collection | null,
  setCollections: React.Dispatch<React.SetStateAction<Collection[]>>,
  setError: (error: string) => void
) => {
  const [isProcessingContent, setIsProcessingContent] = useState(false);

  const extractVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '0e3GPea1Tyg';
  };

  const handleAddVideo = async (url: string) => {
    if (!url) {
      setError('Please enter a YouTube URL');
      return;
    }

    try {
      setIsProcessingContent(true);
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
        throw new Error('No collection selected');
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
      setCollections((prevCollections: Collection[]) => 
        prevCollections.map((col: Collection) => 
          col.id === targetCollection!.id
            ? { ...col, items: [...col.items, newVideo] }
            : col
        )
      );

    } catch (error) {
      console.error('Error adding video:', error);
      setError('Failed to add video. Please try again.');
    } finally {
      setIsProcessingContent(false);
    }
  };

  const handleTranscriptGenerated = async (
    transcript: TranscriptResponse,
    setVideoList: React.Dispatch<React.SetStateAction<VideoItem[]>>,
    setSelectedVideo: (video: VideoItem | null) => void,
    setRawResponse: (response: TranscriptResponse | null) => void,
    setEmbeddings: (embeddings: any[]) => void
  ) => {
    try {
      const newVideo: VideoItem = {
        id: `local-${Date.now()}`,
        url: 'local',
        title: `Uploaded Video`,
        type: 'local'
      };

      // Generate embeddings for the transcript
      const embeddingsPromises = transcript.transcripts.map(async (segment) => {
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

  return {
    handleAddVideo,
    handleTranscriptGenerated,
    isProcessingContent,
    extractVideoId
  };
}; 