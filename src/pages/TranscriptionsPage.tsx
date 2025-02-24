import React, { useState, useEffect } from 'react';
import { FileText, Youtube, FolderOpen, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import TranscriptViewer from '../components/TranscriptViewer';
import PDFViewer from '../components/PDFViewer';
import ReferencedAnswer from '../components/ReferencedAnswer';
import { VideoItem, ExtractedContent, Message, Collection, ContentSource, ContentLocation } from '../types';
import { Reference } from '../types/reference';
import { extractReferences } from '../utils/reference';
import YoutubePlayer from '../components/YoutubePlayer';
import QASection from '../components/QASection';

interface TranscriptionsPageProps {
  collections: Collection[];
  selectedCollection: Collection | null;
  onSelectCollection: (collection: Collection | null) => void;
  selectedVideo: VideoItem | null;
  rawResponse: {
    transcripts: TranscriptSegment[];
  } | null;
  messages: Message[];
  question: string;
  askingQuestion: boolean;
  onQuestionChange: (value: string) => void;
  onAskQuestion: () => void;
  durationFilter: number;
  onDurationFilterChange: (value: number) => void;
  onSeek: (timestamp: number) => void;
  loadingTranscript: boolean;
  extractedText: ExtractedContent[];
  formatTime: (seconds: number) => string;
  groupTranscriptsByDuration: (transcripts: TranscriptSegment[]) => TranscriptGroup[];
  calculateTotalDuration: (transcripts: TranscriptSegment[]) => number;
  formatDurationLabel: (duration: number) => string;
  currentTimestamp: number;
  onReferenceClick: (source: ContentSource) => void;
  onTranscriptLoad?: (data: { transcripts: TranscriptSegment[] }) => void;
  onVideoSelect?: (video: VideoItem) => void;
  onGenerateNotes: () => Promise<void>;
  studyNotes: string;
  generatingNotes: boolean;
  loadingNotes: boolean;
}

// Add this type for file type filtering
type FileType = 'all' | 'youtube' | 'pdf' | 'txt' | 'ppt' | 'pptx';

interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

interface TranscriptGroup {
  startTime: number;
  endTime: number;
  text: string;
}

interface LocationState {
  selectedItemId: string;
  timestamp: number | null;
}

const TranscriptionsPage: React.FC<TranscriptionsPageProps> = ({
  collections,
  selectedCollection,
  onSelectCollection,
  selectedVideo,
  rawResponse,
  messages,
  question,
  askingQuestion,
  onQuestionChange,
  onAskQuestion,
  durationFilter,
  onDurationFilterChange,
  onSeek,
  loadingTranscript,
  extractedText,
  formatTime,
  groupTranscriptsByDuration,
  calculateTotalDuration,
  formatDurationLabel,
  currentTimestamp,
  onReferenceClick,
  onTranscriptLoad,
  onVideoSelect,
  onGenerateNotes,
  studyNotes,
  generatingNotes,
  loadingNotes
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasSelectedCollection, setHasSelectedCollection] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const allItems = collections.flatMap(collection => collection.items);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const selectedItem = selectedItemId ? allItems.find(item => item.id === selectedItemId) : null;
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);

  // Update the useEffect hook
  useEffect(() => {
    console.log('DEBUG: useEffect triggered with selectedItemId:', selectedItemId);
    console.log('DEBUG: Current selectedCollection:', selectedCollection);
    
    if (!selectedItemId || !selectedCollection) {
      console.log('DEBUG: Missing required data, returning early');
      return;
    }

    const selectedItem = selectedCollection.items.find(item => item.id === selectedItemId);
    console.log('DEBUG: Found selected item:', selectedItem);
    
    if (!selectedItem) {
      console.error('DEBUG: Selected item not found in collection');
      return;
    }

    const loadContent = async () => {
      try {
        // Handle YouTube content
        if (selectedItem.type === 'youtube') {
          console.log('DEBUG: Loading YouTube content');
          
          // Load video title
          const videoId = selectedItem.youtube_id || extractVideoId(selectedItem.url);
          try {
            const response = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${import.meta.env.VITE_YOUTUBE_API_KEY}`
            );
            const data = await response.json();
            if (data.items && data.items.length > 0) {
              console.log('DEBUG: Setting video title:', data.items[0].snippet.title);
              setVideoTitle(data.items[0].snippet.title);
            }
          } catch (error) {
            console.log('DEBUG: Using fallback title:', selectedItem.title);
            setVideoTitle(selectedItem.title);
          }

          // Load transcript
          if (selectedItem.transcript) {
            console.log('DEBUG: Processing transcript data');
            const transcriptArray = Array.isArray(selectedItem.transcript) ? selectedItem.transcript :
              typeof selectedItem.transcript === 'string' ? JSON.parse(selectedItem.transcript) : [];
            
            const validTranscripts = transcriptArray.filter((t: TranscriptSegment) => t && typeof t.start !== 'undefined');
            console.log('DEBUG: Valid transcripts count:', validTranscripts.length);
            
            if (validTranscripts.length > 0) {
              console.log('DEBUG: Calling onTranscriptLoad');
              onTranscriptLoad?.({ transcripts: validTranscripts });
            }
          }
        }

        // Handle pending seek after content is loaded
        if (pendingSeek !== null) {
          console.log('DEBUG: Handling pending seek:', pendingSeek);
          onSeek(pendingSeek);
          setPendingSeek(null);
        }
      } catch (error) {
        console.error('DEBUG: Error loading content:', error);
      }
    };

    // Execute content loading immediately
    loadContent();
  }, [selectedItemId, selectedCollection, pendingSeek]);

  // Add a function to reset states
  const resetStates = () => {
    setSelectedItemId('');
    // Reset any other local states here
  };

  // Update the back button click handler
  const handleBackClick = () => {
    onSelectCollection(null);
    setHasSelectedCollection(false);
    resetStates();
    // Clear the messages when going back
    onQuestionChange(''); // Clear question input
    if (typeof window !== 'undefined') {
      // Clear chat history from local storage
      localStorage.removeItem('chatHistory');
    }
  };

  // Update the collection selection handler
  const handleCollectionSelect = (collection: Collection) => {
    onSelectCollection(collection);
    setHasSelectedCollection(true);
    resetStates();
    // Clear the messages when selecting a new collection
    onQuestionChange(''); // Clear question input
    if (typeof window !== 'undefined') {
      // Clear chat history from local storage
      localStorage.removeItem('chatHistory');
    }
  };

  const handleReferenceClick = async (reference: Reference) => {
    console.log('DEBUG: Reference clicked:', reference);
    
    // Find the referenced file in the collection
    const referencedFile = selectedCollection?.items.find(
      item => {
        if (item.type !== reference.sourceType) return false;
        
        // For YouTube videos, match by URL, title, or youtube_id
        if (item.type === 'youtube') {
          const sourceTitle = reference.sourceTitle.toLowerCase();
          const itemTitle = item.title.toLowerCase();
          const itemUrl = item.url.toLowerCase();
          const videoId = item.youtube_id || extractVideoId(item.url);
          
          return itemUrl === sourceTitle || 
                 itemTitle === sourceTitle ||
                 sourceTitle.includes(videoId);
        }
        
        // For other types, match by title
        return item.title === reference.sourceTitle;
      }
    );
    
    console.log('DEBUG: Found referenced file:', referencedFile);

    if (referencedFile) {
      try {
        // First, set the selected item ID
        setSelectedItemId(referencedFile.id);
        console.log('DEBUG: Set selected item ID:', referencedFile.id);

        // Then update parent state
        if (onVideoSelect) {
          console.log('DEBUG: Calling onVideoSelect');
          await onVideoSelect(referencedFile);
        }

        // Convert timestamp if present
        let timestamp = null;
        if (reference.location?.type === 'timestamp') {
      const timeValue = reference.location.value;
          if (typeof timeValue === 'string' && timeValue.includes(':')) {
            const [minutes, seconds] = timeValue.split(':').map(Number);
            timestamp = (minutes * 60) + seconds;
          } else {
            timestamp = parseInt(String(timeValue));
          }
          console.log('DEBUG: Converted timestamp:', timestamp);
        }

        // Convert to ContentSource and call parent handler
        const contentSource: ContentSource = {
          type: reference.sourceType as ContentSource['type'],
              title: reference.sourceTitle,
          location: reference.location && {
            type: reference.location.type as ContentLocation['type'],
            value: timestamp || reference.location.value
          }
        };

        // Call parent handler to update App state
        console.log('DEBUG: Calling onReferenceClick with:', contentSource);
        onReferenceClick(contentSource);

        // If it's a YouTube video, handle transcript
        if (referencedFile.type === 'youtube' && referencedFile.transcript) {
          console.log('DEBUG: Loading transcript data');
          const transcriptArray = Array.isArray(referencedFile.transcript) ? referencedFile.transcript :
            typeof referencedFile.transcript === 'string' ? JSON.parse(referencedFile.transcript) : [];
          
          const validTranscripts = transcriptArray.filter((t: TranscriptSegment) => t && typeof t.start !== 'undefined');
          
          if (validTranscripts.length > 0) {
            console.log('DEBUG: Setting transcript');
            onTranscriptLoad?.({ transcripts: validTranscripts });
          }

          // Handle timestamp seeking after transcript is loaded
          if (timestamp !== null) {
            console.log('DEBUG: Setting timestamp:', timestamp);
            setTimeout(() => {
              onSeek(timestamp!);
            }, 1500); // Increased delay to ensure video is ready
          }
        }
      } catch (error) {
        console.error('Error loading referenced content:', error);
      }
    } else {
      console.error('Referenced file not found:', reference);
    }
  };

  // Update the dropdown change handler
  const handleItemSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newItemId = e.target.value;
    console.log('DEBUG: handleItemSelect called with:', newItemId);
    
    if (!newItemId || !selectedCollection) {
      console.log('DEBUG: No item ID or collection selected');
      return;
    }

    try {
      const selectedItem = selectedCollection.items.find(item => item.id === newItemId);
      if (!selectedItem) {
        console.log('DEBUG: Selected item not found in collection');
        return;
      }

      console.log('DEBUG: Found selected item:', selectedItem);
      setSelectedItemId(newItemId);

      // Update parent state
      if (onVideoSelect) {
        console.log('DEBUG: Calling onVideoSelect');
        await onVideoSelect(selectedItem);
      }

      if (selectedItem.type === 'youtube') {
        // Load transcript if available
        if (selectedItem.transcript) {
          console.log('DEBUG: Processing transcript data');
          const transcriptArray = Array.isArray(selectedItem.transcript) ? selectedItem.transcript :
            typeof selectedItem.transcript === 'string' ? JSON.parse(selectedItem.transcript) : [];
          
          const validTranscripts = transcriptArray.filter((t: TranscriptSegment) => t && typeof t.start !== 'undefined');
          console.log('DEBUG: Valid transcripts count:', validTranscripts.length);
          
          if (validTranscripts.length > 0 && onTranscriptLoad) {
            console.log('DEBUG: Loading transcript');
            onTranscriptLoad({ transcripts: validTranscripts });
          }
        }

        // Load video title
        const videoId = selectedItem.youtube_id || extractVideoId(selectedItem.url);
        try {
          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${import.meta.env.VITE_YOUTUBE_API_KEY}`
          );
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            console.log('DEBUG: Setting video title:', data.items[0].snippet.title);
            setVideoTitle(data.items[0].snippet.title);
          }
        } catch (error) {
          console.log('DEBUG: Using fallback title:', selectedItem.title);
          setVideoTitle(selectedItem.title);
        }
      }
    } catch (error) {
      console.error('Error loading selected item:', error);
    }
  };

  // Update effect to handle navigation state
  useEffect(() => {
    console.log('DEBUG: Navigation state changed:', location.state);
    
    const state = location.state as LocationState | null;
    if (!state) return;

    const { selectedItemId: newItemId, timestamp } = state;
    
    if (newItemId && selectedCollection) {
      console.log('DEBUG: Setting new item ID:', newItemId);
      setSelectedItemId(newItemId);
      
      const item = selectedCollection.items.find(item => item.id === newItemId);
      console.log('DEBUG: Found item:', item);
      
      if (item) {
        // Force a view update by setting the video first
        if (onVideoSelect) {
          console.log('DEBUG: Calling onVideoSelect');
          onVideoSelect(item);
        }

        // Handle YouTube content
        if (item.type === 'youtube' && item.transcript) {
          console.log('DEBUG: Processing YouTube content');
          const transcriptArray = Array.isArray(item.transcript) ? item.transcript :
            typeof item.transcript === 'string' ? JSON.parse(item.transcript) : [];
          
          const validTranscripts = transcriptArray.filter((t: TranscriptSegment) => t && typeof t.start !== 'undefined');
          
          if (validTranscripts.length > 0 && onTranscriptLoad) {
            console.log('DEBUG: Loading transcript');
            onTranscriptLoad({ transcripts: validTranscripts });
          }
        }
        
        // Handle timestamp if present
        if (timestamp !== null) {
          console.log('DEBUG: Setting timestamp:', timestamp);
          // Add a small delay to ensure the video is loaded
          setTimeout(() => {
            onSeek(Number(timestamp));
          }, 1000); // Increased delay to ensure video is ready
        }
      }
    }
  }, [location.state, selectedCollection, onVideoSelect, onTranscriptLoad, onSeek]);

  if (!hasSelectedCollection || !selectedCollection) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-3xl w-full p-6">
          <h1 className="text-2xl font-bold text-center mb-8">
            Select a Knowledge Base to Chat With
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {collections.map(collection => (
              <div
                key={collection.id}
                onClick={() => handleCollectionSelect(collection)}
                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-500 cursor-pointer transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FolderOpen className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{collection.name}</h2>
                    <p className="text-sm text-gray-500">
                      {collection.items.length} files
                    </p>
                  </div>
                </div>
                
                {collection.description && (
                  <p className="text-gray-600 mb-4">{collection.description}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {collection.items.slice(0, 3).map(item => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm text-gray-600"
                    >
                      {item.type === 'youtube' ? (
                        <Youtube className="w-3 h-3 text-red-500" />
                      ) : (
                        <FileText className="w-3 h-3 text-blue-500" />
                      )}
                      {item.title.length > 20 ? `${item.title.slice(0, 20)}...` : item.title}
                    </span>
                  ))}
                  {collection.items.length > 3 && (
                    <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                      +{collection.items.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Chat Section */}
      <div className="w-[60%] border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackClick}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Back to Knowledge Base selection"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h2 className="text-lg font-semibold">{selectedCollection.name}</h2>
                <p className="text-sm text-gray-500">
                  Chat with {selectedCollection.items.length} files
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => {
            // Extract references for assistant messages
            const { text, references } = message.role === 'assistant' 
              ? extractReferences(message.content)
              : { text: message.content, references: [] };

            return (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}>
                  {message.role === 'user' ? (
                    message.content
                  ) : (
                    <ReferencedAnswer
                      answer={text}
                      references={references}
                      onReferenceClick={handleReferenceClick}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <input
            type="text"
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder={`Ask a question about ${selectedCollection.name}...`}
            className="w-full px-4 py-2 rounded-lg border border-gray-300"
          />
          <button
            onClick={onAskQuestion}
            disabled={askingQuestion || !question}
            className="w-full mt-2 px-4 py-2 bg-black text-white rounded-lg disabled:opacity-50"
          >
            {askingQuestion ? 'Thinking...' : `Ask about ${selectedCollection.name}`}
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="w-[40%] h-screen flex flex-col">
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex flex-col space-y-3">
            <h2 className="text-lg font-semibold">View Content</h2>
            <select
              value={selectedItemId}
              onChange={handleItemSelect}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Select a file to view</option>
              {selectedCollection.items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {selectedItem ? (
            <>
              {selectedItem.type === 'youtube' && (
                <div className="h-full flex flex-col">
                  <div className="bg-white shadow-sm border border-gray-200 flex-shrink-0">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Youtube className="w-5 h-5 text-red-600" />
                        {videoTitle || selectedItem.title}
                      </h3>
                    </div>
                    <div className="w-full" style={{ position: 'relative', paddingTop: '56.25%' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                        <YoutubePlayer
                          videoId={selectedItem.youtube_id || extractVideoId(selectedItem.url)}
                          currentTime={currentTimestamp}
                          onSeek={onSeek}
                        />
                      </div>
                    </div>
                  </div>
                  {selectedItem.transcript && (
                    <div className="flex-1 overflow-y-auto">
                <TranscriptViewer 
                  videoUrl={selectedItem.url}
                  transcripts={Array.isArray(selectedItem.transcript) ? 
                    selectedItem.transcript.filter(t => t && typeof t.start !== 'undefined') : 
                    []
                  }
                  durationFilter={durationFilter}
                  onDurationFilterChange={onDurationFilterChange}
                  onSeek={onSeek}
                  loadingTranscript={loadingTranscript}
                  groupTranscriptsByDuration={groupTranscriptsByDuration}
                  formatTime={formatTime}
                  calculateTotalDuration={calculateTotalDuration}
                  formatDurationLabel={formatDurationLabel}
                />
                    </div>
                  )}
                </div>
              )}
              {['pdf', 'txt', 'ppt', 'pptx'].includes(selectedItem.type) && (
                <div className="h-full overflow-y-auto">
                <PDFViewer 
                  type={selectedItem.type}
                  title={selectedItem.title}
                  loading={false}
                  extractedText={selectedItem.extractedContent || []}
                />
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a file to view its content</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Add helper function to extract video ID
const extractVideoId = (url: string): string => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : '';
};

export default TranscriptionsPage; 