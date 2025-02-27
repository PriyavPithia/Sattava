import React, { useState } from 'react';
import ContentAddition from '../components/ContentAddition';
import { Collection, VideoItem, AddVideoMethod } from '../types';
import { Plus, FolderPlus, FileText, Youtube, Pencil, Trash2, ArrowLeft } from 'lucide-react';

interface UploadPageProps {
  addVideoMethod: AddVideoMethod;
  setAddVideoMethod: (method: AddVideoMethod) => void;
  url: string;
  setUrl: (url: string) => void;
  onAddVideo: () => void;
  onTranscriptGenerated: (transcript: any) => void;
  onError: (error: string) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTextSubmit?: (text: string) => void;
  isProcessingContent: boolean;
  collections: Collection[];
  selectedCollection: Collection | null;
  onSelectCollection: (collection: Collection | null) => void;
  onCreateProject: (name: string, description?: string) => Promise<void>;
  onUpdateProject: (id: string, name: string, description?: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onDeleteContent: (collectionId: string, contentId: string) => Promise<void>;
}

const UploadPage: React.FC<UploadPageProps> = ({
  addVideoMethod,
  setAddVideoMethod,
  url,
  setUrl,
  onAddVideo,
  onTranscriptGenerated,
  onError,
  onFileSelect,
  onTextSubmit,
  isProcessingContent,
  collections,
  selectedCollection,
  onSelectCollection,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onDeleteContent
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [showAddContent, setShowAddContent] = useState(false);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateProject(newName, newDescription);
      setIsCreating(false);
      setNewName('');
      setNewDescription('');
    } catch (error) {
      console.error('Error creating project:', error);
      onError('Failed to create knowledge base');
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollection) return;
    
    try {
      await onUpdateProject(selectedCollection.id, newName, newDescription);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating project:', error);
      onError('Failed to update knowledge base');
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this knowledge base?')) return;
    
    try {
      await onDeleteProject(id);
      onSelectCollection(null);
    } catch (error) {
      console.error('Error deleting project:', error);
      onError('Failed to delete knowledge base');
    }
  };

  const handleDeleteContent = async (collectionId: string, contentId: string) => {
    if (!window.confirm('Are you sure you want to delete this content?')) return;
    
    try {
      await onDeleteContent(collectionId, contentId);
    } catch (error) {
      console.error('Error deleting content:', error);
      onError('Failed to delete content');
    }
  };

  const handleTextSubmit = (text: string) => {
    if (text && text.trim()) {
      const file = new File([text], `text-input-${Date.now()}.txt`, { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const event = {
        target: {
          files: dataTransfer.files
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
      onFileSelect(event);
    }
  };

  if (selectedCollection) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => onSelectCollection(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {isEditing ? (
                <form onSubmit={handleUpdateProject} className="flex items-center gap-4">
                  <div>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="text-2xl font-bold border-b-2 focus:border-black outline-none"
                      required
                    />
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="block mt-1 text-gray-600 border-b focus:border-black outline-none"
                      placeholder="Description (optional)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-3 py-1 bg-black text-white rounded-lg text-sm"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <h1 className="text-2xl font-bold">{selectedCollection.name}</h1>
                  {selectedCollection.description && (
                    <p className="text-gray-600 mt-1">{selectedCollection.description}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setNewName(selectedCollection.name);
                  setNewDescription(selectedCollection.description || '');
                  setIsEditing(true);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <Pencil className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDeleteProject(selectedCollection.id)}
                className="p-2 hover:bg-gray-100 rounded-full text-red-600"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content Section */}
          {showAddContent ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Add Content</h2>
                <button
                  onClick={() => setShowAddContent(false)}
                  className="text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
              <ContentAddition 
                addVideoMethod={addVideoMethod}
                setAddVideoMethod={setAddVideoMethod}
                url={url}
                setUrl={setUrl}
                onAddVideo={onAddVideo}
                onTranscriptGenerated={onTranscriptGenerated}
                onError={onError}
                onFileSelect={onFileSelect}
                onTextSubmit={handleTextSubmit}
                isProcessingContent={isProcessingContent}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowAddContent(true)}
              className="w-full py-3 border-2 border-dashed rounded-lg text-gray-600 hover:bg-gray-50 mb-8"
            >
              <Plus className="w-5 h-5 mx-auto mb-1" />
              Add Content
            </button>
          )}

          {/* Content List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedCollection.items.map((item: VideoItem) => (
              <div 
                key={item.id}
                className="p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {item.type === 'youtube' ? (
                      <Youtube className="w-5 h-5 text-red-600" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-600" />
                    )}
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-gray-500">{item.type}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteContent(selectedCollection.id, item.id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded-full text-gray-600"
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

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Knowledge Bases</h1>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-black text-white rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Knowledge Base
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreateProject} className="mb-8 p-6 border rounded-lg bg-gray-50">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Knowledge Base Name"
              className="w-full px-4 py-2 text-lg font-medium border rounded-lg mb-3"
              required
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-4 py-2 border rounded-lg mb-4 h-24"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-black text-white rounded-lg"
              >
                Create
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection: Collection) => (
            <div
              key={collection.id}
              onClick={() => onSelectCollection(collection)}
              className="p-6 border rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{collection.name}</h3>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {collection.items.length} items
                </span>
              </div>
              {collection.description && (
                <p className="text-gray-600 mb-4 line-clamp-2">{collection.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {collection.items.slice(0, 3).map((item: VideoItem) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1 text-sm"
                  >
                    {item.type === 'youtube' ? (
                      <Youtube className="w-3 h-3" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )}
                    <span className="truncate max-w-[100px]">{item.title}</span>
                  </div>
                ))}
                {collection.items.length > 3 && (
                  <div className="bg-gray-100 rounded-full px-2 py-1 text-sm">
                    +{collection.items.length - 3} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UploadPage; 