import React from 'react';
import { FileText, Home, Upload, UserCircle, LogOut } from 'lucide-react';
import { getDocument } from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

import { useAppState } from './hooks/useAppState';
import { useVideoHandling } from './hooks/useVideoHandling';
import { useStudyNotes } from './hooks/useStudyNotes';
import { HighlightProvider } from './contexts/HighlightContext';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import TranscriptionsPage from './pages/TranscriptionsPage';
import NavLink from './components/NavLink';

// Update PDF.js worker configuration
GlobalWorkerOptions.workerSrc = pdfjsWorker;

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const appState = useAppState();
  const videoHandling = useVideoHandling(
    appState.selectedCollection,
    appState.setCollections,
    appState.setError
  );
  const studyNotes = useStudyNotes();

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <HighlightProvider>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
            <div className="p-4 border-b border-gray-200">
              <h1 className="text-xl font-semibold">Sattva AI</h1>
            </div>
            
            <nav className="flex-1 p-4 space-y-2">
              <NavLink to="/" icon={Home}>Home</NavLink>
              <NavLink to="/upload" icon={Upload}>Knowledgebases</NavLink>
              <NavLink to="/transcriptions" icon={FileText}>Transcriptions</NavLink>
            </nav>

            {/* User Profile Section */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center space-x-3 mb-3">
                <UserCircle className="w-8 h-8 text-gray-600" />
                <div className="flex-1 truncate">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route 
                path="/upload" 
                element={
                  <UploadPage 
                    {...appState}
                    onAddVideo={videoHandling.handleAddVideo}
                    onTranscriptGenerated={(transcript) => videoHandling.handleTranscriptGenerated(
                      transcript,
                      appState.setVideoList,
                      appState.setSelectedVideo,
                      appState.setRawResponse,
                      appState.setEmbeddings
                    )}
                    isProcessingContent={videoHandling.isProcessingContent}
                  />
                } 
              />
              <Route 
                path="/transcriptions" 
                element={
                  <TranscriptionsPage 
                    {...appState}
                    onGenerateNotes={() => studyNotes.handleGenerateStudyNotes(appState.rawResponse)}
                    studyNotes={studyNotes.studyNotes}
                    generatingNotes={studyNotes.generatingNotes}
                    loadingNotes={studyNotes.loadingNotes}
                  />
                } 
              />
            </Routes>
          </div>
        </div>
      </HighlightProvider>
    </Router>
  );
}

export default App;