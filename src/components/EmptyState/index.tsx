import React, { useState } from 'react';
import { FileText, Plus } from 'lucide-react';

interface EmptyStateProps {
  onCreateProject: (name: string, description?: string) => Promise<void>;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onCreateProject }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      setError('');
      await onCreateProject(name, description);
      setName('');
      setDescription('');
      setIsCreating(false);
    } catch (err) {
      setError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  if (!isCreating) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center text-gray-500 mb-4">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>Create a project to get started</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Plus className="w-4 h-4" />
          Create Project
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Create a New Project</h2>
        {error && (
          <div className="mb-4 text-red-600 bg-red-50 p-3 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Project Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter project name"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 h-24"
              placeholder="Enter project description"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmptyState; 