import React, { useState, useEffect } from 'react';
import { 
  FileText, Youtube, FolderOpen, Plus, ArrowLeft, BookOpen, 
  Loader2, Edit, MessageSquare, Trash2, Pencil, Eye, CheckCircle, XCircle, ChevronDown, Check, X
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import TranscriptViewer from '../components/TranscriptViewer';
import PDFViewer from '../components/PDFViewer';
import ReferencedAnswer from '../components/ReferencedAnswer';
import QASection from '../components/QASection';
import { loadChat } from '../utils/database';
import { 
  VideoItem, ExtractedContent, Message, Collection, 
  ContentSource, ContentLocation
} from '../types';
import { Reference } from '../types/reference';
import { extractReferences } from '../utils/reference';
import YoutubePlayer from '../components/YoutubePlayer';
import ContentAddition from '../components/ContentAddition';
import AddContentSection from '../components/AddContentSection';

// Import the component-specific CombinedContent type
import { CombinedContent as ComponentCombinedContent } from '../components/types';

interface KnowledgebasePageProps {
  // Collection/Project management
  collections: Collection[];
  selectedCollection: Collection | null;
  onSelectCollection: (collection: Collection | null) => void;
  onCreateProject: (name: string, description?: string) => Promise<void>;
  onUpdateProject: (id: string, name: string, description?: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onDeleteContent: (collectionId: string, contentId: string) => Promise<void>;
  
  // Content viewing
  selectedVideo: VideoItem | null;
  rawResponse: {
    transcripts: TranscriptSegment[];
  } | null;
  loadingTranscript: boolean;
  extractedText: ExtractedContent[];
  currentTimestamp: number;
  onSeek: (timestamp: number) => void;
  onVideoSelect?: (video: VideoItem) => void;
  
  // Transcript viewing settings
  durationFilter: number;
  onDurationFilterChange: (value: number) => void;
  formatTime: (seconds: number) => string;
  groupTranscriptsByDuration: (transcripts: TranscriptSegment[]) => TranscriptGroup[];
  calculateTotalDuration: (transcripts: TranscriptSegment[]) => number;
  formatDurationLabel: (duration: number) => string;
  
  // QA functionality
  messages: Message[];
  question: string;
  askingQuestion: boolean;
  onQuestionChange: (value: string) => void;
  onAskQuestion: () => void;
  onReferenceClick: (source: ContentSource) => void;
  onGenerateNotes: () => Promise<void>;
  generatingNotes: boolean;
  
  // Content addition
  addVideoMethod: 'youtube' | 'pdf' | 'file';
  setAddVideoMethod: (method: 'youtube' | 'pdf' | 'file') => void;
  url: string;
  setUrl: (url: string) => void;
  onAddVideo: () => void;
  onTranscriptGenerated: (transcript: any) => void;
  onError: (error: string) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessingContent: boolean;
  
  // Chat history
  loadChat: (collectionId: string) => Promise<Message[]>;
  setMessages: (messages: Message[]) => void;
}

// Types
type ViewMode = 'list' | 'chat';
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

// Add Toast component
const Toast: React.FC<{
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white transform transition-transform duration-300 ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="w-5 h-5" />
      ) : (
        <XCircle className="w-5 h-5" />
      )}
      {message}
    </div>
  );
};

const KnowledgebasePage: React.FC<KnowledgebasePageProps> = ({
  // Collection props
  collections,
  selectedCollection,
  onSelectCollection,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onDeleteContent,
  
  // Content props
  selectedVideo,
  rawResponse,
  loadingTranscript,
  extractedText,
  currentTimestamp,
  onSeek,
  onVideoSelect,
  
  // Transcript props
  durationFilter,
  onDurationFilterChange,
  formatTime,
  groupTranscriptsByDuration,
  calculateTotalDuration,
  formatDurationLabel,
  
  // QA props
  messages,
  question,
  askingQuestion,
  onQuestionChange,
  onAskQuestion,
  onReferenceClick,
  onGenerateNotes,
  generatingNotes,
  
  // Content addition props
  addVideoMethod,
  setAddVideoMethod,
  url,
  setUrl,
  onAddVideo,
  onTranscriptGenerated,
  onError,
  onFileSelect,
  isProcessingContent,
  
  // Chat history props
  loadChat,
  setMessages,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileType>('all');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isEditingCollection, setIsEditingCollection] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState<string | null>(null);
  
  // Keep loadCollectionData function inside the component but outside useEffect
  const loadCollectionData = async (collection: Collection, newViewMode: ViewMode) => {
    // Always update the selected collection
    console.log('Setting selected collection from URL:', collection.name);
    onSelectCollection(collection);
    setViewMode(newViewMode);

    // Load chat history and select file when entering chat mode
    if (newViewMode === 'chat') {
      try {
        const savedMessages = await loadChat(collection.id);
        console.log('Loaded messages:', savedMessages);
        setMessages(savedMessages || []);

        // Always ensure a file is selected in chat mode
        if (!selectedVideo && collection.items.length > 0) {
          const firstItem = collection.items[0];
          if (onVideoSelect) {
            onVideoSelect(firstItem);
          }
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        setMessages([]);
      }
    }
  };

  // Update the handleViewModeChange function
  const handleViewModeChange = async (mode: ViewMode, collection: Collection) => {
    if (mode === 'chat') {
      try {
        await loadCollectionData(collection, mode);
        navigate(`/knowledgebase/${collection.id}/chat`);
      } catch (error) {
        console.error('Error switching to chat mode:', error);
      }
    } else {
      setViewMode(mode);
      if (collection) {
        navigate(`/knowledgebase/${collection.id}/${mode}`);
      }
    }
  };

  // Update the URL change effect to use the defined loadCollectionData
  useEffect(() => {
    const path = location.pathname;
    console.log('URL path changed:', path);
    
    // If we're at the base knowledgebase path, reset state
    if (path === '/knowledgebase') {
      console.log('At base knowledgebase path, resetting state');
      setViewMode('list');
      setMessages([]);
      if (selectedVideo) {
        onVideoSelect?.(null as any); // Type assertion to handle null
      }
      onSelectCollection(null);
      return;
    }
    
    // Check if we have a collection ID in the URL
    const match = path.match(/\/knowledgebase\/([^\/]+)(?:\/([^\/]+))?/);
    if (match) {
      const collectionId = match[1];
      const viewModeFromUrl = match[2];
      console.log('URL params:', { collectionId, viewModeFromUrl });
      
      // Find the collection with this ID
      const collection = collections.find(c => c.id === collectionId);
      console.log('Found collection:', collection);
      
      if (collection) {
        const newViewMode = (viewModeFromUrl === 'chat') ? 'chat' : 'list';
        loadCollectionData(collection, newViewMode);
      }
    }
  }, [location.pathname, collections]);
  
  // Maintain URL when selection changes
  useEffect(() => {
    console.log('Selection or view mode changed:', { 
      selectedCollection: selectedCollection?.name, 
      viewMode 
    });
    
    if (selectedCollection) {
      const newPath = viewMode === 'list' 
        ? `/knowledgebase/${selectedCollection.id}`
        : `/knowledgebase/${selectedCollection.id}/${viewMode}`;
      
      console.log('Updating URL to:', newPath);
      if (location.pathname !== newPath) {
        navigate(newPath);
      }
    }
  }, [selectedCollection, viewMode]);
  
  // Add this function near the top of the component
  const handleHomeClick = () => {
    // Reset all necessary state
    setViewMode('list');
    onSelectCollection(null);
    // Reset any other relevant state here
    if (selectedVideo && onVideoSelect) {
      // @ts-ignore - Intentionally passing null to reset the video selection
      onVideoSelect(null);
    }
    // Navigate to home page
    navigate('/');
  };
  
  // Handle navigating back to the list view
  const handleBackToList = () => {
    // Reset view mode
    setViewMode('list');
    // Reset collection selection
    onSelectCollection(null);
    // Reset other relevant state
    if (selectedVideo && onVideoSelect) {
      // @ts-ignore - Intentionally passing null to reset the video selection
      onVideoSelect(null);
    }
    // Navigate to the main knowledgebase page
    navigate('/knowledgebase');
  };
  
  // Handle selecting a collection and showing the mode selection UI
  const handleCollectionSelect = (collection: Collection) => {
    // First update the selection
    onSelectCollection(collection);
    // Then update view mode and navigate
    setViewMode('list');
    navigate(`/knowledgebase/${collection.id}`);
  };
  
  // Handle creating a new collection
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateProject(newName, newDescription);
      setIsCreatingCollection(false);
      setNewName('');
      setNewDescription('');
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      onError('Failed to create knowledge base');
    }
  };
  
  // Handle updating a collection
  const handleUpdateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollection) return;
    
    try {
      await onUpdateProject(selectedCollection.id, newName, newDescription);
      setIsEditingCollection(false);
    } catch (error) {
      console.error('Error updating knowledge base:', error);
      onError('Failed to update knowledge base');
    }
  };

  // Handle deleting a collection
  const handleDeleteCollection = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this knowledge base?')) return;
    
    try {
      await onDeleteProject(id);
      onSelectCollection(null);
      setViewMode('list');
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      onError('Failed to delete knowledge base');
    }
  };
  
  // Filter items by file type
  const filterItemsByType = (items: VideoItem[]): VideoItem[] => {
    console.log('Filtering items by type:', fileTypeFilter, items);
    if (!items || !Array.isArray(items)) {
      console.error('Invalid items array:', items);
      return [];
    }
    if (fileTypeFilter === 'all') return items;
    return items.filter(item => item.type === fileTypeFilter);
  };

  // Handle selecting a video/content item
  const handleItemSelect = (item: VideoItem) => {
    if (onVideoSelect) {
      onVideoSelect(item);
    }
  };
  
  // Handle reference clicks (for YouTube timestamps, PDF pages, etc.)
  const handleReferenceClick = (reference: Reference) => {
    // Convert Reference to ContentSource format
    const contentSource: ContentSource = {
      type: reference.sourceType,
      title: reference.sourceTitle,
      location: {
        type: reference.location.type,
        value: typeof reference.location.value === 'string' 
          ? parseFloat(reference.location.value) 
          : reference.location.value
      }
    };
    onReferenceClick(contentSource);
  };

  // Update the content deletion handler
  const handleDeleteContent = async (collectionId: string, contentId: string) => {
    if (!window.confirm('Are you sure you want to delete this content?')) return;
    
    try {
      await onDeleteContent(collectionId, contentId);
      setToast({
        message: 'Content deleted successfully',
        type: 'success'
      });
    } catch (error) {
      setToast({
        message: 'Failed to delete content',
        type: 'error'
      });
    }
  };

  // Remove the chat loading effect since it's handled by the parent
  useEffect(() => {
    if (isProcessingContent === false) {
      setToast({
        message: 'Content added successfully',
        type: 'success'
      });
    }
  }, [isProcessingContent]);

  // Add this function to handle inline name editing
  const handleNameEdit = async (collectionId: string, newName: string) => {
    try {
      await onUpdateProject(collectionId, newName);
      setEditingCollectionName(null);
    } catch (error) {
      console.error('Error updating knowledge base name:', error);
      onError('Failed to update knowledge base name');
    }
  };

  // Add this function to handle project deletion
  const handleDeleteProject = async (collectionId: string) => {
    if (!window.confirm('Are you sure you want to delete this knowledge base? This action cannot be undone.')) {
      return;
    }

    try {
      await onDeleteProject(collectionId);
      setToast({
        message: 'Knowledge base deleted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      setToast({
        message: 'Failed to delete knowledge base',
        type: 'error'
      });
    }
  };

  // Add this function to handle navbar knowledgebase click
  const handleKnowledgebaseNavClick = () => {
    // Reset all states
    setViewMode('list');
    setMessages([]);
    if (selectedVideo && onVideoSelect) {
      onVideoSelect(null);
    }
    onSelectCollection(null);
    navigate('/knowledgebase');
  };

  // First: check if we're showing the collection list (no selection or explicitly showing list)
  if (!selectedCollection) {
    // No collection selected, show the list of all collections
    return (
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Knowledge Bases</h1>
          <button
            onClick={() => {
              setIsCreatingCollection(true);
              setNewName('');
              setNewDescription('');
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Knowledge Base
          </button>
        </div>
        
        {isCreatingCollection ? (
          <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Knowledge Base</h2>
            <form onSubmit={handleCreateCollection}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCollection(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        ) : null}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Make the card clickable */}
              <div 
                onClick={() => handleCollectionSelect(collection)}
                className="p-6 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  {editingCollectionName === collection.id ? (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleNameEdit(collection.id, newName);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 flex-1"
                    >
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="p-1 text-green-600 hover:text-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCollectionName(null);
                          setNewName(collection.name);
                        }}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <FolderOpen className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">
                        {collection.name}
                      </h2>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCollectionName(collection.id);
                        setNewName(collection.name);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(collection.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 mb-4">
                  {collection.items?.length || 0} items
                </p>
              </div>
              
              {/* Action buttons */}
              <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCollectionSelect(collection);
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Files
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewModeChange('chat', collection);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  disabled={collection.items?.length === 0}
                  title={collection.items?.length === 0 ? "Add content to start chatting" : "Start chatting"}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Edit collection form */}
        {isEditingCollection && selectedCollection && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Edit Knowledge Base</h2>
              <form onSubmit={handleUpdateCollection}>
                <div className="mb-4">
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="edit-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingCollection(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md"
                  >
                    Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Chat mode - show content and QA section
  if (viewMode === 'chat' && selectedCollection) {
    const items = selectedCollection.items || [];
    return (
      <div className="h-[calc(100vh-94px)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBackToList}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold">{selectedCollection.name}</h1>
            <div className="relative ml-4">
              <select
                className="appearance-none pl-10 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                value={selectedVideo?.id || ''}
                onChange={(e) => {
                  const video = selectedCollection.items.find(item => item.id === e.target.value);
                  if (video && onVideoSelect) {
                    onVideoSelect(video);
                  }
                }}
              >
                <option value="" disabled>Select content to view</option>
                {selectedCollection.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.type === 'youtube' ? '🎥 ' : '📄 '}
                    {item.title || item.url}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <Eye className="w-4 h-4 text-gray-500" />
              </div>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Content viewer section - 35% width */}
          <div className="w-[35%] border-r border-gray-200">
            {/* Content viewer */}
            <div className="h-full overflow-y-auto">
              {selectedVideo && (
                <div className="h-full">
                  {selectedVideo.type === 'youtube' && (
                    <div className="h-[300px] bg-black">
                      <YoutubePlayer
                        videoId={selectedVideo.youtube_id || ''}
                        currentTime={currentTimestamp}
                        onSeek={onSeek}
                      />
                    </div>
                  )}

                  {selectedVideo.type === 'youtube' && rawResponse && (
                    <TranscriptViewer
                      videoUrl={selectedVideo.url}
                      transcripts={rawResponse.transcripts}
                      durationFilter={durationFilter}
                      onDurationFilterChange={onDurationFilterChange}
                      onSeek={onSeek}
                      loadingTranscript={loadingTranscript}
                      groupTranscriptsByDuration={groupTranscriptsByDuration}
                      formatTime={formatTime}
                      calculateTotalDuration={calculateTotalDuration}
                      formatDurationLabel={formatDurationLabel}
                    />
                  )}

                  {['pdf', 'txt', 'ppt', 'pptx'].includes(selectedVideo.type) && (
                    <PDFViewer
                      type={selectedVideo.type}
                      title={selectedVideo.title}
                      loading={loadingTranscript}
                      extractedText={extractedText}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* QA section - 65% width */}
          <div className="w-[65%] overflow-hidden flex flex-col">
            <QASection
              messages={messages}
              question={question}
              askingQuestion={askingQuestion}
              onQuestionChange={onQuestionChange}
              onAskQuestion={onAskQuestion}
              onReferenceClick={handleReferenceClick}
            />
          </div>
        </div>
      </div>
    );
  }
  
  // Render collection view when a collection is selected but not in chat mode
  if (selectedCollection && viewMode === 'list') {
    const items = selectedCollection.items || [];
    console.log('Rendering collection view:', selectedCollection);
    console.log('Collection items:', items);
    
    // Ensure items exist and is an array
    const collectionItems = Array.isArray(items) ? items : [];
    const filteredItems = filterItemsByType(collectionItems);
    
    console.log('Filtered items:', filteredItems);
    
    return (
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBackToList}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            {editingCollectionName === selectedCollection.id ? (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNameEdit(selectedCollection.id, newName);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-2xl font-bold border-b-2 border-blue-500 focus:outline-none bg-transparent"
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1 text-green-600 hover:text-green-700"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCollectionName(null);
                    setNewName(selectedCollection.name);
                  }}
                  className="p-1 text-red-600 hover:text-red-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <h1 
                className="text-2xl font-bold cursor-pointer hover:text-blue-600 flex items-center gap-2"
                onClick={() => {
                  setEditingCollectionName(selectedCollection.id);
                  setNewName(selectedCollection.name);
                }}
              >
                {selectedCollection.name}
                <Pencil className="w-4 h-4 opacity-50" />
              </h1>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleViewModeChange('chat', selectedCollection)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
              disabled={selectedCollection.items.length === 0}
              title={selectedCollection.items.length === 0 ? "Add content to start chatting" : "Start chatting"}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
          </div>
        </div>

        {/* Add Content Section */}
        <div className="mb-8">
          <AddContentSection
            addVideoMethod={addVideoMethod}
            setAddVideoMethod={setAddVideoMethod}
            url={url}
            setUrl={setUrl}
            onAddVideo={onAddVideo}
            onFileSelect={onFileSelect}
            isProcessingContent={isProcessingContent}
            onTranscriptGenerated={onTranscriptGenerated}
            onError={onError}
          />
        </div>

        {/* Content Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setFileTypeFilter('all')}
                className={`${
                  fileTypeFilter === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium`}
              >
                All Files
              </button>
              <button
                onClick={() => setFileTypeFilter('youtube')}
                className={`${
                  fileTypeFilter === 'youtube'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium`}
              >
                Videos
              </button>
              <button
                onClick={() => setFileTypeFilter('pdf')}
                className={`${
                  fileTypeFilter === 'pdf'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium`}
              >
                PDFs
              </button>
              <button
                onClick={() => setFileTypeFilter('txt')}
                className={`${
                  fileTypeFilter === 'txt'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium`}
              >
                Text Files
              </button>
            </nav>
          </div>
        </div>

        {/* Collection Contents */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 group"
            >
              {/* Card Header with Icon */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {item.type === 'youtube' && <Youtube className="w-5 h-5 text-red-600" />}
                    {item.type === 'pdf' && <FileText className="w-5 h-5 text-blue-600" />}
                    {item.type === 'txt' && <FileText className="w-5 h-5 text-green-600" />}
                    {(item.type === 'ppt' || item.type === 'pptx') && (
                      <FileText className="w-5 h-5 text-orange-600" />
                    )}
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {item.type}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteContent(selectedCollection.id, item.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {item.title}
                </h3>
                
                {/* YouTube Thumbnail or File Icon */}
                {item.type === 'youtube' && item.youtube_id && (
                  <div className="aspect-video mb-4 rounded-md overflow-hidden">
                    <img 
                      src={`https://img.youtube.com/vi/${item.youtube_id}/mqdefault.jpg`}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex justify-end mt-4 space-x-2">
                  <button
                    onClick={() => handleItemSelect(item)}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View Content
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // This ensures we don't get a null return value
  return null;
};

export default KnowledgebasePage; 