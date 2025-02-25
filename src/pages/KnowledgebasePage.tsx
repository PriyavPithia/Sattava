import React, { useState } from 'react';
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
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileType>('all');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isEditingCollection, setIsEditingCollection] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  
  // Handle navigating back to the list view
  const handleBackToList = () => {
    setViewMode('list');
    onSelectCollection(null);
  };
  
  // Handle selecting a collection and showing the mode selection UI
  const handleCollectionSelect = (collection: Collection) => {
    onSelectCollection(collection);
    setViewMode('list');
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

  // Render collection list when no collection is selected or in list view
  if (!selectedCollection || viewMode === 'list') {
    return (
      <div className="flex-1 p-6">
        {selectedCollection ? (
          <div className="mb-8">
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
                  onClick={() => setViewMode('chat')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </button>
                <button
                  onClick={() => setViewMode('edit')}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </div>
            </div>
            <p className="text-gray-600 mb-6">{selectedCollection.description}</p>
            
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
            
            {/* Collection contents */}
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
        ) : (
          <>
            {/* Knowledge bases list */}
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
                  className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">{collection.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setIsEditingCollection(true);
                          setNewName(collection.name);
                          setNewDescription(collection.description || '');
                          onSelectCollection(collection);
                        }}
                        className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCollection(collection.id)}
                        className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {collection.description && (
                    <p className="text-gray-600 mb-3 text-sm line-clamp-2">{collection.description}</p>
                  )}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-500">
                      {collection.items.length} items
                    </div>
                    <button
                      onClick={() => handleCollectionSelect(collection)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        
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
  if (viewMode === 'chat') {
    return (
      <div className="flex-1 p-6">
        <div className="flex items-center gap-2 mb-6">
          <button 
            onClick={() => setViewMode('list')}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold">{selectedCollection.name} - Chat</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Content viewer */}
          <div className="space-y-6">
            {selectedVideo && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  {selectedVideo.type === 'youtube' && <Youtube className="w-5 h-5 text-red-600" />}
                  {selectedVideo.type === 'pdf' && <FileText className="w-5 h-5 text-blue-600" />}
                  {selectedVideo.type === 'txt' && <FileText className="w-5 h-5 text-green-600" />}
                  {(selectedVideo.type === 'ppt' || selectedVideo.type === 'pptx') && (
                    <FileText className="w-5 h-5 text-orange-600" />
                  )}
                  {selectedVideo.title}
                </h2>
                
                {selectedVideo.type === 'youtube' && selectedVideo.youtube_id && (
                  <div className="aspect-video mb-4">
                    <YoutubePlayer
                      videoId={selectedVideo.youtube_id}
                      currentTime={currentTimestamp}
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
          
          {/* QA section */}
          <div>
            <QASection
              messages={messages.map(msg => {
                // Convert Message to QASection's expected message format
                const qaMessage = {
                  role: msg.role,
                  content: msg.content,
                  references: msg.references ? msg.references.map(ref => {
                    // Convert ContentSource location to string format expected by CombinedContent
                    const locationString = ref.source.location 
                      ? (typeof ref.source.location === 'string' 
                        ? ref.source.location 
                        : ref.source.location.type === 'timestamp' 
                          ? `${Math.floor(ref.source.location.value / 60)}:${String(Math.floor(ref.source.location.value % 60)).padStart(2, '0')}` 
                          : String(ref.source.location.value))
                      : undefined;
                    
                    // Create a CombinedContent compatible object
                    return {
                      text: ref.text,
                      source: {
                        type: ref.source.type,
                        title: ref.source.title,
                        location: locationString
                      }
                    } as ComponentCombinedContent;
                  }) : undefined
                };
                return qaMessage;
              })}
              question={question}
              askingQuestion={askingQuestion}
              onQuestionChange={onQuestionChange}
              onAskQuestion={onAskQuestion}
            />
            
            <div className="mt-4">
              <button
                onClick={onGenerateNotes}
                disabled={generatingNotes}
                className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generatingNotes ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Notes...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    Generate Study Notes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Edit mode - add/remove content
  if (viewMode === 'edit') {
    return (
      <div className="flex-1 p-6">
        <div className="flex items-center gap-2 mb-6">
          <button 
            onClick={() => setViewMode('list')}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold">{selectedCollection.name} - Edit</h1>
        </div>
        
        <ContentAddition
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
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Collection Content</h2>
          
          {selectedCollection.items.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No content in this knowledge base</p>
              <p className="text-gray-500 text-sm">
                Add YouTube videos, PDFs, or text files using the form above
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedCollection.items.map((item) => (
                <div 
                  key={item.id} 
                  className="border border-gray-200 rounded-lg p-4"
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
                      onClick={() => onDeleteContent(selectedCollection.id, item.id)}
                      className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return null;
};

export default KnowledgebasePage; 