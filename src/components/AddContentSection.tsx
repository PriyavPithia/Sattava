import React, { useRef, useState, useEffect } from 'react';
import { Upload, Youtube, FileText, Paperclip, Mic, MicOff, Type, X, Settings, Loader2, Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Link as LinkIcon, PlusCircle } from 'lucide-react';
import axios from 'axios';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import AudioUploader from './AudioUploader';

// Import our custom editor styles
import '../styles/editor.css';

// Note: You'll need to add the CSS import where applicable
// Import styles in a CSS/SCSS file or global styles
// import 'react-quill/dist/quill.snow.css';

interface SpinnerProps {
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className = "w-5 h-5" }) => (
  <div className={`animate-spin ${className}`}>
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
);

interface AddContentSectionProps {
  addVideoMethod: 'youtube' | 'files' | 'speech' | 'text' | 'video';
  setAddVideoMethod: (method: 'youtube' | 'files' | 'speech' | 'text' | 'video') => void;
  url: string;
  setUrl: (url: string) => void;
  onAddVideo: () => void;
  onTranscriptGenerated: (transcript: any) => void;
  onError: (error: string) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTextSubmit?: (text: string) => void;
  isProcessingContent: boolean;
}

// Define SpeechRecognition types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart?: () => void;
}

// Add MenuButton component for the editor toolbar
interface MenuButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}

const MenuButton: React.FC<MenuButtonProps> = ({ onClick, isActive, title, children }) => {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 rounded ${
        isActive ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-700'
      }`}
    >
      {children}
    </button>
  );
};

const AddContentSection: React.FC<AddContentSectionProps> = ({
  addVideoMethod,
  setAddVideoMethod,
  url,
  setUrl,
  onAddVideo,
  onFileSelect,
  isProcessingContent,
  onTranscriptGenerated,
  onError,
  onTextSubmit,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textInput, setTextInput] = useState<string>('');
  
  // Add speech recognition states
  const [transcription, setTranscription] = useState<string>('');
  const [permanentTranscript, setPermanentTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);
  const [isAudioApiSupported, setIsAudioApiSupported] = useState<boolean>(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Replace richTextValue state with TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Enter or format your notes here...',
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Get HTML content when editor changes
      const html = editor.getHTML();
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
        spellcheck: 'true',
      },
    },
  });

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(e);
    }
  };

  // Function to strip HTML tags
  const stripHtmlTags = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  const handleTextSubmit = () => {
    if (onTextSubmit) {
      // For Notes tab, use rich text value from the editor
      if (addVideoMethod === 'text' && editor) {
        const html = editor.getHTML();
        if (html && html !== '<p></p>') {
          // Strip HTML tags before submitting
          const plainText = stripHtmlTags(html);
          onTextSubmit(plainText);
        }
      } else if (textInput.trim()) {
        // For other tabs, use regular text input
        onTextSubmit(textInput);
      }
    }
  };

  // Speech recognition handlers
  const handleSpeechSubmit = () => {
    if (onTextSubmit && transcription.trim()) {
      // Create an object with metadata to identify it as a speech transcription
      const speechData = {
        text: transcription.trim(),
        type: 'speech',
        source: 'browser_transcription'
      };
      
      // Convert to JSON string for consistency with the API response format
      onTextSubmit(JSON.stringify(speechData));
      
      // Reset the transcription
      setPermanentTranscript('');
      setInterimTranscript('');
      setTranscription('');
      
      setDebugInfo('Speech transcription submitted to knowledge base');
    }
  };

  // Audio file handling
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState<boolean>(false);

  const handleAudioFileButtonClick = () => {
    if (audioFileInputRef.current) {
      audioFileInputRef.current.click();
    }
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
      onError('Please select an audio file.');
      return;
    }
    
    try {
      setIsTranscribingAudio(true);
      setDebugInfo(`Starting server-side transcription for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // Check file size before processing
      if (file.size > 25 * 1024 * 1024) { // 25MB limit
        throw new Error('Audio file exceeds 25MB limit. Please select a smaller file.');
      }
      
      // Create form data for server upload
      const formData = new FormData();
      formData.append('audio', file);
      
      // Send the file to the Whisper API endpoint
      const response = await axios.post('/api/whisper-transcription', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data && response.data.transcription) {
        setTranscription(response.data.transcription);
        setPermanentTranscript(response.data.transcription);
        setInterimTranscript('');
        setDebugInfo(`Transcription complete: ${response.data.transcription.substring(0, 30)}...`);
      } else {
        throw new Error('No transcription returned from server');
      }
    } catch (error) {
      console.error('Error transcribing audio file:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error transcribing audio file';
        
      setDebugInfo(`Audio transcription error: ${errorMessage}`);
      onError(errorMessage);
    } finally {
      setIsTranscribingAudio(false);
      // Reset file input
      if (audioFileInputRef.current) {
        audioFileInputRef.current.value = '';
      }
    }
  };

  // Check browser compatibility on component mount
  useEffect(() => {
    // Check if SpeechRecognition is supported
    const isSpeechSupp = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSpeechSupported(isSpeechSupp);
    
    // Check if Web Audio API is supported
    const isAudioSupp = 'AudioContext' in window || 'webkitAudioContext' in window;
    setIsAudioApiSupported(isAudioSupp);
    
    if (!isSpeechSupp) {
      console.error('SpeechRecognition is not supported in this browser');
      onError('Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.');
      setDebugInfo('SpeechRecognition API not supported in this browser');
    } else if (!isAudioSupp) {
      console.error('Web Audio API is not supported in this browser');
      onError('Audio processing is not fully supported in this browser. Please try Chrome, Edge, or Safari for full functionality. ');
      setDebugInfo('Web Audio API not supported in this browser');
    } else {
      setDebugInfo('Speech and Audio APIs supported');
      
      // Initialize the recognition object on mount
      initializeSpeechRecognition();
    }
  }, [onError]);
  
  // Initialize speech recognition
  const initializeSpeechRecognition = () => {
    try {
      // Use type assertion to handle the Speech Recognition API
      const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognitionConstructor) {
        setDebugInfo('Could not create SpeechRecognition constructor');
        setIsSpeechSupported(false);
        return;
      }
      
      recognitionRef.current = new SpeechRecognitionConstructor() as SpeechRecognition;
      
      if (!recognitionRef.current) {
        setDebugInfo('Failed to initialize SpeechRecognition object');
        setIsSpeechSupported(false);
        return;
      }
      
      setDebugInfo('SpeechRecognition initialized');
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US'; // Set language explicitly
      
      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        setDebugInfo('Recognition started');
        setIsRecording(true);
      };
      
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        try {
          let currentInterim = '';
          let finalText = '';
          
          // Process results
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
              finalText += transcript + ' ';
            } else {
              currentInterim += transcript;
            }
          }
          
          // Log to debug
          setDebugInfo(`Interim: "${currentInterim}"`);
          
          // Update states
          if (finalText) {
            // When we get final text, add it to the permanent transcript
            setPermanentTranscript(prev => prev + finalText);
            setInterimTranscript(''); // Clear interim when we get final text
          } else {
            // Otherwise just update the interim text
            setInterimTranscript(currentInterim);
          }
        } catch (error) {
          console.error('Error processing speech results:', error);
          setDebugInfo(`Error processing results: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error);
        setDebugInfo(`Recognition error: ${event.error}`);
        onError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
      };
      
      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        setDebugInfo('Recognition ended');
        
        // Only set isRecording to false if we didn't manually stop it
        // This prevents the recognition from stopping unexpectedly
        if (isRecording) {
          // Try to restart if it stopped unexpectedly
          try {
            if (recognitionRef.current) {
              recognitionRef.current.start();
              console.log('Restarted speech recognition after unexpected end');
              setDebugInfo('Recognition restarted');
            }
          } catch (error) {
            console.error('Failed to restart speech recognition', error);
            setDebugInfo(`Failed to restart: ${error instanceof Error ? error.message : String(error)}`);
            setIsRecording(false);
          }
        }
      };
      
      setDebugInfo('SpeechRecognition fully configured');
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      setDebugInfo(`Init error: ${error instanceof Error ? error.message : String(error)}`);
      setIsSpeechSupported(false);
    }
  };

  // Update combined transcription whenever permanent or interim transcript changes
  useEffect(() => {
    setTranscription(permanentTranscript + interimTranscript);
  }, [permanentTranscript, interimTranscript]);

  const toggleRecording = () => {
    setDebugInfo(`Toggle recording from ${isRecording ? 'on' : 'off'} to ${isRecording ? 'off' : 'on'}`);
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    if (!recognitionRef.current) {
      setDebugInfo('No recognition object available');
      onError('Speech recognition is not supported or not initialized');
      return;
    }

    try {
      console.log('Starting speech recognition');
      setDebugInfo('Starting recognition...');
      recognitionRef.current.start();
      // Note: The actual setting of isRecording happens in the onstart event handler
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setDebugInfo(`Start error: ${error instanceof Error ? error.message : String(error)}`);
      onError(`Failed to start speech recognition: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!recognitionRef.current) {
      setDebugInfo('No recognition object to stop');
      return;
    }
    
    if (isRecording) {
      try {
        console.log('Stopping speech recognition');
        setDebugInfo('Stopping recognition');
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
        setDebugInfo(`Stop error: ${error instanceof Error ? error.message : String(error)}`);
      }
      setIsRecording(false);
    }
  };

  const clearTranscription = () => {
    setPermanentTranscript('');
    setInterimTranscript('');
    setTranscription('');
    setDebugInfo('Transcription cleared');
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current && isRecording) {
        try {
          recognitionRef.current.stop();
          console.log('Speech recognition stopped on unmount');
        } catch (error) {
          console.error('Error stopping speech recognition on cleanup', error);
        }
      }
    };
  }, [isRecording]);

  // Function to add a new paragraph
  const addNewParagraph = () => {
    if (editor) {
      editor.chain().focus().setHardBreak().run();
      editor.chain().focus().setHardBreak().run();
    }
  };

  // Clear editor content when processing is complete
  useEffect(() => {
    if (!isProcessingContent && editor && editor.getHTML() !== '<p></p>') {
      // When processing is finished and we had content, clear the editor
      editor.commands.clearContent();
    }
  }, [isProcessingContent, editor]);

  const handleTranscriptionComplete = (newTranscription: string) => {
    if (onTextSubmit) {
      // Create a speech data object with the transcription
      const speechData = {
        text: newTranscription,
        type: 'speech',
        source: 'whisper_transcription'
      };
      
      // Submit the transcription to be added to the knowledge base
      onTextSubmit(JSON.stringify(speechData));
      
      // Clear the transcription after submission to prevent duplicate entries
      setTranscription('');
      setPermanentTranscript('');
      setInterimTranscript('');
    }
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setDebugInfo(`Selected file: ${file.name} (${file.type})`);
  };

  const handleVideoSubmit = async () => {
    if (!selectedFile) {
      console.log('No video file selected');
      return;
    }

    const formData = new FormData();
    formData.append('video', selectedFile);

    try {
      console.log('Starting video conversion...');
      const response = await axios.post('/api/convert', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          console.log(`Upload progress: ${percentCompleted}%`);
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      // Get the audio blob from the response
      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      
      // Create a new FormData for the audio transcription
      const audioFormData = new FormData();
      audioFormData.append('audio', audioBlob, 'converted-audio.mp3');

      // Send the audio for transcription
      const transcriptionResponse = await axios.post('/api/whisper-transcription', audioFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (transcriptionResponse.data.error) {
        throw new Error(transcriptionResponse.data.error);
      }

      // Handle successful transcription
      if (onTranscriptGenerated) {
        onTranscriptGenerated(transcriptionResponse.data);
      }

    } catch (error: any) {
      console.error('Error processing video:', error);
      let errorMessage = 'Failed to process video. Please try again.';
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 405) {
          errorMessage = 'Server endpoint not properly configured. Please check server setup.';
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex space-x-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setAddVideoMethod('youtube')}
          className={`flex items-center px-3 py-2 rounded-lg ${
            addVideoMethod === 'youtube'
              ? 'bg-red-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Youtube className="w-5 h-5 mr-2" />
          YouTube
        </button>
        <button
          onClick={() => setAddVideoMethod('files')}
          className={`flex items-center px-3 py-2 rounded-lg ${
            addVideoMethod === 'files'
              ? 'bg-red-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Upload className="w-5 h-5 mr-2" />
          Files
        </button>
        <button
          onClick={() => setAddVideoMethod('speech')}
          className={`flex items-center px-3 py-2 rounded-lg ${
            addVideoMethod === 'speech'
              ? 'bg-red-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Mic className="w-5 h-5 mr-2" />
          Speech
        </button>
        <button
          onClick={() => setAddVideoMethod('text')}
          className={`flex items-center px-3 py-2 rounded-lg ${
            addVideoMethod === 'text'
              ? 'bg-red-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Type className="w-5 h-5 mr-2" />
          Text
        </button>
        <button
          onClick={() => setAddVideoMethod('video')}
          className={`flex items-center px-3 py-2 rounded-lg ${
            addVideoMethod === 'video'
              ? 'bg-red-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-5 h-5 mr-2" />
          Video
        </button>
      </div>

      {/* Content based on selected method */}
      <div className="mt-4">
        {addVideoMethod === 'youtube' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter YouTube URL
            </label>
            <div className="flex">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 border border-gray-300 rounded-l px-4 py-2"
                disabled={isProcessingContent}
              />
              <button
                onClick={onAddVideo}
                disabled={!url || isProcessingContent}
                className={`px-4 py-2 rounded-r flex items-center justify-center ${
                  !url || isProcessingContent
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isProcessingContent ? (
                  <Spinner className="w-5 h-5" />
                ) : (
                  <span>Process</span>
                )}
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Paste a YouTube URL to transcribe the video and add it to your knowledgebase.
            </p>
          </div>
        )}
        
        {addVideoMethod === 'files' && (
          <div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.txt,.ppt,.pptx,.doc,.docx"
                className="hidden"
                disabled={isProcessingContent}
              />
              {isProcessingContent ? (
                <div className="flex flex-col items-center">
                  <Spinner className="w-8 h-8 text-blue-500" />
                  <p className="mt-2 text-sm text-gray-600">Processing file...</p>
                </div>
              ) : (
                <div 
                  className="flex flex-col items-center cursor-pointer"
                  onClick={handleFileButtonClick}
                >
                  <Upload className="w-12 h-12 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-900">Click to upload files</p>
                  <p className="mt-1 text-xs text-gray-500">or drag and drop</p>
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Upload PDF, text files (.txt), PowerPoint (.ppt, .pptx), or Word documents (.doc, .docx).
            </p>
          </div>
        )}
        
        {addVideoMethod === 'speech' && (
          <div>
            {!isSpeechSupported ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-700">
                  Speech recognition is not supported in your browser. Please try Chrome, Edge, or Safari.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-6">
                  <div className="flex-1 rounded-lg p-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">Live Recording</h3>
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-4 mb-4">
                        <button
                          onClick={toggleRecording}
                          className={`flex items-center gap-2 px-6 py-3 rounded-lg ${
                            isRecording
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          disabled={isTranscribingAudio}
                        >
                          {isRecording ? (
                            <>
                              <MicOff className="w-5 h-5" />
                              <span>Stop Recording</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-5 h-5" />
                              <span>Start Recording</span>
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={clearTranscription}
                          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          <span>Clear</span>
                        </button>
                      </div>
                      
                      {isRecording && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Listening...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">Upload Audio File</h3>
                    <AudioUploader onTranscriptionComplete={handleTranscriptionComplete} />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transcription 
                    {isRecording && <span className="text-xs text-blue-500 ml-2">(Recording in progress...)</span>}
                  </label>
                  <textarea
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    placeholder="Transcription will appear here. You can edit it if needed."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg h-40"
                    disabled={isTranscribingAudio}
                  />
                  <button
                    onClick={handleSpeechSubmit}
                    disabled={!transcription.trim() || isProcessingContent || isTranscribingAudio}
                    className={`mt-4 px-4 py-2 rounded flex items-center justify-center w-full ${
                      !transcription.trim() || isProcessingContent || isTranscribingAudio
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {isProcessingContent || isTranscribingAudio ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : null}
                    <span>Add to Knowledge Base</span>
                  </button>
                </div>
              </div>
            )}
            
            <p className="mt-2 text-sm text-gray-500">
              Record your speech or upload an audio file for transcription.
            </p>
          </div>
        )}
        
        {addVideoMethod === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Notes
            </label>
            <div className="mb-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-1">
                    <MenuButton
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      isActive={editor?.isActive('bold')}
                      title="Bold"
                    >
                      <Bold className="w-4 h-4" />
                    </MenuButton>
                    <MenuButton
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      isActive={editor?.isActive('italic')}
                      title="Italic"
                    >
                      <Italic className="w-4 h-4" />
                    </MenuButton>
                  </div>

                  <div className="w-px h-6 bg-gray-200 mx-1" />

                  <div className="flex items-center gap-1">
                    <MenuButton
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                      isActive={editor?.isActive('heading', { level: 1 })}
                      title="Heading 1"
                    >
                      <Heading1 className="w-4 h-4" />
                    </MenuButton>
                    <MenuButton
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                      isActive={editor?.isActive('heading', { level: 2 })}
                      title="Heading 2"
                    >
                      <Heading2 className="w-4 h-4" />
                    </MenuButton>
                  </div>

                  <div className="w-px h-6 bg-gray-200 mx-1" />

                  <div className="flex items-center gap-1">
                    <MenuButton
                      onClick={() => editor?.chain().focus().toggleBulletList().run()}
                      isActive={editor?.isActive('bulletList')}
                      title="Bullet List"
                    >
                      <List className="w-4 h-4" />
                    </MenuButton>
                    <MenuButton
                      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                      isActive={editor?.isActive('orderedList')}
                      title="Numbered List"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </MenuButton>
                  </div>

                  <div className="w-px h-6 bg-gray-200 mx-1" />

                  <div className="flex items-center gap-1">
                    <MenuButton
                      onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                      isActive={editor?.isActive('blockquote')}
                      title="Quote"
                    >
                      <Quote className="w-4 h-4" />
                    </MenuButton>
                    <MenuButton
                      onClick={() => {
                        const url = window.prompt('Enter the URL');
                        if (url && editor) {
                          editor.chain().focus().setLink({ href: url }).run();
                        }
                      }}
                      isActive={editor?.isActive('link')}
                      title="Add Link"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </MenuButton>
                  </div>

                  <div className="w-px h-6 bg-gray-200 mx-1" />

                  <MenuButton
                    onClick={addNewParagraph}
                    title="Add New Paragraph"
                  >
                    <PlusCircle className="w-4 h-4" />
                  </MenuButton>
                </div>

                <div className="p-4 tiptap-editor">
                  <EditorContent 
                    editor={editor} 
                    className="min-h-[120px] prose prose-sm max-w-none focus-within:outline-none" 
                  />
                </div>

                <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Tip: Press Enter twice to create a new paragraph, or use the + button in the toolbar
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleTextSubmit}
              disabled={!editor || editor.isEmpty || isProcessingContent}
              className={`mt-2 px-4 py-2 rounded flex items-center justify-center ${
                !editor || editor.isEmpty || isProcessingContent
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isProcessingContent ? (
                <Spinner className="w-5 h-5 mr-2" />
              ) : null}
              <span>Add to Knowledge Base</span>
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Add formatted notes directly to your knowledge base for quick reference.
            </p>
          </div>
        )}

        {addVideoMethod === 'video' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoFileChange}
                className="hidden"
                ref={fileInputRef}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={loading}
              >
                <Upload className="w-5 h-5 mr-2" />
                Select Video
              </button>
              {selectedFile && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected: {selectedFile.name}
                </div>
              )}
              <button
                onClick={handleVideoSubmit}
                disabled={!selectedFile || loading}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin inline" />
                    Converting...
                  </>
                ) : (
                  'Convert Video'
                )}
              </button>
            </div>

            {audioUrl && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Converted Audio:</h3>
                <audio controls src={audioUrl} className="w-full"></audio>
                <a
                  href={audioUrl}
                  download="converted.mp3"
                  className="mt-2 inline-block text-red-600 hover:text-red-700"
                >
                  Download Audio
                </a>
              </div>
            )}

            {/* Debug Section */}
            {debugInfo && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Debug Info:</h3>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {debugInfo}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddContentSection; 