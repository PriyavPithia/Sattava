import React from 'react';
import { FileText, Loader2, Youtube, Check, Edit2, Trash2 } from 'lucide-react';
import { VideoItem } from '../types';

interface ProjectContentProps {
  items: VideoItem[];
  selectedVideo: VideoItem | null;
  onSelectVideo: (video: VideoItem) => void;
  onRemoveVideo: (id: string) => void;
  onStartEditing: (video: VideoItem) => void;
  onSaveTitle: (id: string) => void;
  editingTitle: string;
  setEditingTitle: (title: string) => void;
  isProcessingContent: boolean;
  setRawResponse: (response: any) => void;
}

const ProjectContent: React.FC<ProjectContentProps> = ({
  items,
  selectedVideo,
  onSelectVideo,
  onRemoveVideo,
  onStartEditing,
  onSaveTitle,
  editingTitle,
  setEditingTitle,
  isProcessingContent,
  setRawResponse
}) => {
  const handleVideoSelect = (video: VideoItem) => {
    console.log('Selected video:', video); // Debug log
    
    if (video.type === 'youtube' && video.transcript) {
      const transcriptArray = Array.isArray(video.transcript) ? video.transcript : [];
      console.log('Setting transcript array:', transcriptArray);
      setRawResponse({ 
        transcripts: transcriptArray.filter(t => t && typeof t.start !== 'undefined')
      });
    } else if (['pdf', 'txt', 'ppt', 'pptx'].includes(video.type) && video.extractedContent) {
      console.log('Setting extracted content:', video.extractedContent);
      setRawResponse({ transcripts: [] }); // Clear any transcript data
    }
    
    onSelectVideo(video);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <FileText className="w-5 h-5 text-red-600" />
        Project Content
      </h2>

      {isProcessingContent && (
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Processing content...</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => handleVideoSelect(item)}
            className={`p-3 rounded-lg cursor-pointer ${
              selectedVideo?.id === item.id
                ? 'bg-red-50'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.type === 'youtube' && (
                  <Youtube className="w-5 h-5 text-red-600" />
                )}
                {(item.type === 'pdf' || item.type === 'txt') && (
                  <FileText className="w-5 h-5 text-red-600" />
                )}
                {item.isEditing ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSaveTitle(item.id);
                      }
                    }}
                    className="border rounded px-2 py-1"
                    autoFocus
                  />
                ) : (
                  <span className="text-gray-700">{item.title}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {item.isEditing ? (
                  <button
                    onClick={() => onSaveTitle(item.id)}
                    className="p-1 hover:text-green-600"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEditing(item);
                    }}
                    className="p-1 hover:text-blue-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveVideo(item.id);
                  }}
                  className="p-1 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectContent; 