import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

const HomePage = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold mb-4">Welcome to Sattva AI</h1>
      <p className="text-gray-600 max-w-2xl">
        Upload and transcribe various formats, including YouTube URLs, PDFs, 
        text files, and PowerPoints. Use the sidebar to navigate through 
        different sections of the application.
      </p>
      
      <p className="text-sm text-gray-500 mt-4">
        If you experience issues with Google Sign-In, please use email/password authentication.
      </p>
      
      <div className="mt-8">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default HomePage; 