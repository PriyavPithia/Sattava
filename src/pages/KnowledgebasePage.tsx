import React, { useState, useEffect } from 'react';
import { 
  FileText, Youtube, FolderOpen, Plus, ArrowLeft, BookOpen, 
  Loader2, Edit, MessageSquare, Trash2, Pencil
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import TranscriptViewer from '../components/TranscriptViewer';
import PDFViewer from '../components/PDFViewer';
import ReferencedAnswer from '../components/ReferencedAnswer';
import QASection from '../components/QASection';
import { 
  VideoItem, ExtractedContent, Message, Collection, 
  ContentSource, ContentLocation
} from '../types';
import { Reference } from '../types/reference';
import { extractReferences } from '../utils/reference';
import YoutubePlayer from '../components/YoutubePlayer';
import ContentAddition from '../components/ContentAddition';

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
  addVideoMethod: 'youtube' | 'upload' | 'file';
  setAddVideoMethod: (method: 'youtube' | 'upload' | 'file') => void;
  url: string;
  setUrl: (url: string) => void;
  onAddVideo: () => void;
  onTranscriptGenerated: (transcript: any) => void;
  onError: (error: string) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessingContent: boolean;
}

// Types
type ViewMode = 'list' | 'chat' | 'edit';
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
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileType>('all');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isEditingCollection, setIsEditingCollection] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  
  // Add useEffect to handle URL changes and route params
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    
    console.log('URL path changed:', location.pathname, 'Selected collection:', selectedCollection?.id);
    
    // Reset state if navigated to the base knowledgebase path
    if (pathParts.length === 2 && pathParts[1] === 'knowledgebase') {
      if (selectedCollection) {
        onSelectCollection(null);
      }
      setViewMode('list');
      return;
    }
    
    if (pathParts.length >= 3 && pathParts[1] === 'knowledgebase') {
      const collectionId = pathParts[2];
      const foundCollection = collections.find(c => c.id === collectionId);
      
      console.log('Looking for collection:', collectionId, 'Found:', foundCollection?.id);
      
      if (foundCollection) {
        // Update selected collection if it's different
        if (!selectedCollection || selectedCollection.id !== foundCollection.id) {
          console.log('Setting selected collection to:', foundCollection.id);
          onSelectCollection(foundCollection);
        }
        
        // Update view mode based on URL
        if (pathParts.length >= 4) {
          const mode = pathParts[3] as ViewMode;
          if (mode === 'chat' || mode === 'edit') {
            setViewMode(mode);
          } else {
            setViewMode('list');
          }
        } else {
          // Default to list view if no specific mode is in the URL
          setViewMode('list');
        }
      }
    }
  }, [location.pathname, collections, selectedCollection, onSelectCollection]);
  
  // Keep the original useEffect for maintaining URL when selection changes
  useEffect(() => {
    if (selectedCollection && viewMode === 'list') {
      // Show collection view
      navigate(`/knowledgebase/${selectedCollection.id}`);
    }
  }, [selectedCollection, viewMode, navigate]);
  
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
    console.log('Collection selected:', collection.id);
    // First update the selection
    onSelectCollection(collection);
    // Then update view mode and navigate
    setViewMode('list');
    // Navigate to the collection view
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
    // Convert the reference location to match ContentSource format
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

  // Update the view mode handlers
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (selectedCollection) {
      navigate(`/knowledgebase/${selectedCollection.id}/${mode}`);
    }
  };

  // Render collection view when a collection is selected but not in chat/edit mode
  if (selectedCollection && viewMode === 'list') {
    console.log('Rendering collection view for:', selectedCollection.id, 'with items:', selectedCollection.items.length);
    
    return (
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleBackToList}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold">{selectedCollection.name}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleHomeClick}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Home
            </button>
            <button
              onClick={() => handleViewModeChange('chat')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => handleViewModeChange('edit')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>

        {/* Collection contents */}
        <div className="mt-6">
          {/* Content filter tabs */}
          <div className="border-b border-gray-200 mb-6">
            <div className="flex gap-4">
              <button
                className={`px-4 py-2 font-medium border-b-2 ${
                  fileTypeFilter === 'all' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setFileTypeFilter('all')}
              >
                All
              </button>
              <button
                className={`px-4 py-2 font-medium border-b-2 ${
                  fileTypeFilter === 'youtube' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setFileTypeFilter('youtube')}
              >
                Videos
              </button>
              <button
                className={`px-4 py-2 font-medium border-b-2 ${
                  fileTypeFilter === 'pdf' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setFileTypeFilter('pdf')}
              >
                PDFs
              </button>
              <button
                className={`px-4 py-2 font-medium border-b-2 ${
                  fileTypeFilter === 'txt' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setFileTypeFilter('txt')}
              >
                Text
              </button>
            </div>
          </div>
          
          {/* Collection contents grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterItemsByType(selectedCollection.items).map((item) => (
              <div 
                key={item.id} 
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                onClick={() => handleItemSelect(item)}
              >
                <div className="flex items-center gap-3 mb-2">
                  {item.type === 'youtube' && <Youtube className="w-5 h-5 text-red-600" />}
                  {item.type === 'pdf' && <FileText className="w-5 h-5 text-blue-600" />}
                  {item.type === 'txt' && <FileText className="w-5 h-5 text-green-600" />}
                  {(item.type === 'ppt' || item.type === 'pptx') && <FileText className="w-5 h-5 text-orange-600" />}
                  <div className="font-medium text-gray-900 truncate flex-1">
                    {item.title}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteContent(selectedCollection.id, item.id);
                    }}
                    className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // This ensures we don't get a null return value
  return null;
};

export default KnowledgebasePage; 