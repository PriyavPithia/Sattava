import React from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { Collection } from '../types';

interface ProjectListProps {
  collections: Collection[];
  selectedCollection: Collection | null;
  onSelectCollection: (collection: Collection) => void;
  onOpenProjectModal: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({
  collections,
  selectedCollection,
  onSelectCollection,
  onOpenProjectModal
}) => {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-red-600" />
          <h2 className="text-lg font-semibold">My Projects</h2>
        </div>
        <button
          onClick={onOpenProjectModal}
          className="text-red-600 hover:text-red-700"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2 mb-6">
        {collections.map(collection => (
          <div
            key={collection.id}
            onClick={() => onSelectCollection(collection)}
            className={`p-4 rounded-lg cursor-pointer ${
              selectedCollection?.id === collection.id
                ? 'bg-red-50 border-l-4 border-red-600'
                : 'hover:bg-gray-50 border-l-4 border-transparent'
            }`}
          >
            <div className="font-medium">{collection.name}</div>
            {collection.description && (
              <div className="text-sm text-gray-500 mt-1">{collection.description}</div>
            )}
            <div className="text-xs text-gray-400 mt-2">
              {collection.items.length} items
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default ProjectList; 