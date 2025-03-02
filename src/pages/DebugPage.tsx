import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const DebugPage: React.FC = () => {
  const { user, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebugInfo = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get environment variables
        const envInfo = {
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'not set',
          hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
          apiUrl: import.meta.env.NEXT_PUBLIC_API_URL || 'not set',
          hasOpenAIKey: !!import.meta.env.VITE_OPENAI_API_KEY,
        };
        
        // Get auth status
        const { data: { session } } = await supabase.auth.getSession();
        
        // Try to get projects
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('id, name, created_at')
          .limit(5);
          
        setDebugInfo({
          timestamp: new Date().toISOString(),
          environment: envInfo,
          auth: {
            isAuthenticated: !!session?.user,
            userId: session?.user?.id || 'not authenticated',
            email: session?.user?.email || 'not available',
          },
          projects: {
            success: !projectsError,
            error: projectsError ? projectsError.message : null,
            count: projects?.length || 0,
            data: projects || [],
          }
        });
      } catch (err: any) {
        console.error('Error fetching debug info:', err);
        setError(err.message || 'An error occurred while fetching debug information');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDebugInfo();
  }, []);
  
  const handleRefresh = () => {
    window.location.reload();
  };
  
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };
  
  const handleCreateTestProject = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('User not authenticated');
        return;
      }
      
      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            name: `Test Project ${new Date().toISOString()}`,
            description: 'Created from debug page',
            user_id: user.id
          }
        ])
        .select('*')
        .single();
        
      if (error) throw error;
      
      alert(`Test project created: ${data.name}`);
      window.location.reload();
    } catch (err: any) {
      console.error('Error creating test project:', err);
      setError(err.message || 'Failed to create test project');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Debug Information</h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          {user ? (
            <div>
              <p className="text-green-600 font-medium">✓ Authenticated</p>
              <p className="mt-2"><strong>User ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <button 
                onClick={handleSignOut}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div>
              <p className="text-red-600 font-medium">✗ Not authenticated</p>
              <p className="mt-2">Please sign in to access all features.</p>
              <a 
                href="/"
                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to Login
              </a>
            </div>
          )}
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Environment</h2>
          <ul className="space-y-2">
            <li><strong>Supabase URL:</strong> {debugInfo.environment?.supabaseUrl}</li>
            <li><strong>Supabase Key:</strong> {debugInfo.environment?.hasSupabaseKey ? '✓ Set' : '✗ Not set'}</li>
            <li><strong>API URL:</strong> {debugInfo.environment?.apiUrl}</li>
            <li><strong>OpenAI Key:</strong> {debugInfo.environment?.hasOpenAIKey ? '✓ Set' : '✗ Not set'}</li>
          </ul>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Projects</h2>
          
          {debugInfo.projects?.success ? (
            <>
              <p className="mb-4">Found {debugInfo.projects?.count} projects.</p>
              
              {debugInfo.projects?.count > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {debugInfo.projects?.data.map((project: any) => (
                      <tr key={project.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{project.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{project.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(project.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No projects found.</p>
              )}
              
              <div className="mt-6">
                <button 
                  onClick={handleCreateTestProject}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mr-4"
                  disabled={!user}
                >
                  Create Test Project
                </button>
              </div>
            </>
          ) : (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
              <p><strong>Error:</strong> {debugInfo.projects?.error}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8 flex justify-center">
        <button 
          onClick={handleRefresh}
          className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
        >
          Refresh Debug Info
        </button>
      </div>
      
      <div className="mt-12 bg-gray-100 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Raw Debug Data</h2>
        <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default DebugPage; 