import React from 'react';

const HomePage = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold mb-4">Welcome to Transcription UI</h1>
      <p className="text-gray-600 max-w-2xl">
        Upload and transcribe various formats, including YouTube URLs, PDFs, 
        text files, and PowerPoints. Use the sidebar to navigate through 
        different sections of the application.
      </p>
    </div>
  );
};

export default HomePage; 