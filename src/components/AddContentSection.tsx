import React, { useRef, useState, useEffect } from 'react';
import { Upload, Youtube, FileText, Paperclip, Mic, MicOff, Type, X } from 'lucide-react';

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
  addVideoMethod: 'youtube' | 'files' | 'speech' | 'text';
  setAddVideoMethod: (method: 'youtube' | 'files' | 'speech' | 'text') => void;
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

  const handleTextSubmit = () => {
    if (onTextSubmit && textInput.trim()) {
      onTextSubmit(textInput);
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
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);

  const handleAudioFileButtonClick = () => {
    if (audioFileInputRef.current) {
      audioFileInputRef.current.click();
    }
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const audioFile = files[0];
    if (!audioFile.type.startsWith('audio/')) {
      onError('Please select an audio file.');
      return;
    }

    try {
      setIsTranscribingAudio(true);
      setDebugInfo(`Preparing to transcribe audio file: ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // Check file size before processing
      if (audioFile.size > 25 * 1024 * 1024) { // 25MB limit
        throw new Error('Audio file exceeds 25MB limit. Please select a smaller file.');
      }

      // Client-side audio processing
      setDebugInfo(`Processing audio file client-side...`);
      
      // Create an AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Read the file as an ArrayBuffer
      const arrayBuffer = await audioFile.arrayBuffer();
      
      // Decode the audio data
      const audioData = await audioContext.decodeAudioData(arrayBuffer);
      
      setDebugInfo(`Audio loaded: ${audioData.duration.toFixed(2)} seconds. Converting to speech using Web Speech API...`);
      
      // Attempt to use the Web Speech API to transcribe the audio
      if (!recognitionRef.current) {
        initializeSpeechRecognition();
        setDebugInfo('Initialized speech recognition for file playback');
      }

      if (!recognitionRef.current) {
        throw new Error('Could not initialize speech recognition');
      }

      // Create an audio element to play the file while transcribing
      const audioElement = new Audio();
      
      // Add error handling for cross-origin issues
      audioElement.crossOrigin = "anonymous";
      audioElement.onerror = (e) => {
        setDebugInfo(`Audio element error: ${(e as any).message || 'Unknown error'}`);
        throw new Error('Error loading audio file. This might be due to cross-origin restrictions.');
      };
      
      const objectUrl = URL.createObjectURL(audioFile);
      audioElement.src = objectUrl;

      // Set up speech recognition
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      // Start recording and playing simultaneously
      setDebugInfo('Starting audio playback and recognition...');
      
      // Create a more robust promise-based approach
      const transcriptionPromise = new Promise<string>((resolve, reject) => {
        // Set timeout for max transcription duration (2x the audio duration to be safe)
        const maxDuration = Math.max(audioData.duration * 2, 30) * 1000; // min 30 seconds
        const timeout = setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
          audioElement.pause();
          resolve(permanentTranscript); // Resolve with what we got so far
          setDebugInfo(`Transcription completed (timeout after ${maxDuration/1000}s)`);
        }, maxDuration);
        
        // Set up event handler for when audio finishes
        audioElement.onended = () => {
          setDebugInfo('Audio playback ended, finalizing transcription...');
          // Give a short delay to capture final words
          setTimeout(() => {
            if (recognitionRef.current) {
              recognitionRef.current.stop();
            }
            clearTimeout(timeout);
            resolve(permanentTranscript);
          }, 1000);
        };
        
        // Add a specific error handler for when audio can't be played
        audioElement.oncanplaythrough = () => {
          setDebugInfo('Audio loaded successfully, starting playback...');
        };
        
        // Handle recognition errors
        if (recognitionRef.current) {
          const originalOnError = recognitionRef.current.onerror;
          recognitionRef.current.onerror = (event) => {
            setDebugInfo(`Recognition error during file playback: ${event.error}`);
            // Still call the original handler
            if (originalOnError) originalOnError(event);
          };
        }
        
        // Start the process
        try {
          if (recognitionRef.current) {
            recognitionRef.current.start();
            audioElement.play().catch(e => {
              setDebugInfo(`Audio playback error: ${e.message}. Try downloading the file and uploading again, or use real-time recording.`);
              reject(new Error(`Could not play audio: ${e.message}. If you're uploading from another site, try downloading the file first.`));
            });
          } else {
            reject(new Error('Speech recognition not available'));
          }
        } catch (e) {
          clearTimeout(timeout);
          audioElement.pause();
          reject(e);
        }
      });
      
      // Wait for transcription to complete
      const finalTranscript = await transcriptionPromise;
      
      // Cleanup
      URL.revokeObjectURL(objectUrl);
      
      if (!finalTranscript.trim()) {
        throw new Error('Unable to transcribe audio. The file might not contain clear speech or the format is not supported.');
      }
      
      setDebugInfo(`Client-side transcription complete: ${finalTranscript.substring(0, 50)}...`);
      
      // Update the transcription area with the result
      setPermanentTranscript(finalTranscript);
      setInterimTranscript('');
      setTranscription(finalTranscript);
      
    } catch (error) {
      console.error('Error transcribing audio file:', error);
      // Only include the original error message without adding "Error transcribing audio:" prefix
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDebugInfo(`Transcription failed: ${errorMessage}`);
      onError(errorMessage);
    } finally {
      setIsTranscribingAudio(false);
      
      // Reset the file input so the same file can be selected again
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Content Type Selector */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setAddVideoMethod('youtube')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
            addVideoMethod === 'youtube' 
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Youtube className="w-5 h-5" />
          <span>YouTube</span>
        </button>
        <button
          onClick={() => setAddVideoMethod('files')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
            addVideoMethod === 'files' 
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Upload Files</span>
        </button>
        <button
          onClick={() => setAddVideoMethod('speech')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
            addVideoMethod === 'speech' 
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Mic className="w-5 h-5" />
          <span>Speech to Text</span>
        </button>
        <button
          onClick={() => setAddVideoMethod('text')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 ${
            addVideoMethod === 'text' 
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Type className="w-5 h-5" />
          <span>Input Text</span>
        </button>
      </div>

      {/* Input Area */}
      <div className="p-6">
        {/* YouTube Mode */}
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

        {/* Consolidated Files Mode */}
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

        {/* Speech to Text Mode */}
        {addVideoMethod === 'speech' && (
          <div>
            {!isSpeechSupported ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-700">
                  Speech recognition is not supported in your browser. Please try Chrome, Edge, or Safari.
                </p>
              </div>
            ) : !isAudioApiSupported ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-700">
                  Audio processing is not fully supported in your browser. Real-time speech works, but 
                  processing audio files may not work properly. Please try Chrome, Edge, or Safari for full functionality.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                  <p className="font-medium mb-1">How This Works:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Real-time speech: Your voice is transcribed as you speak</li>
                    <li>Audio files: Files are played in your browser while being transcribed</li>
                    <li>All processing happens locally - no server needed</li>
                    <li>Quality may vary based on audio clarity and your browser</li>
                  </ul>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
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
                        onClick={handleAudioFileButtonClick}
                        disabled={isRecording || isTranscribingAudio}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg ${
                          isRecording || isTranscribingAudio
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <Upload className="w-5 h-5" />
                        <span>Upload Audio</span>
                      </button>
                      
                      {/* Hidden audio file input */}
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        ref={audioFileInputRef}
                        onChange={handleAudioFileChange}
                        disabled={isRecording || isTranscribingAudio}
                      />
                      
                      <button
                        onClick={clearTranscription}
                        className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        <span>Clear</span>
                      </button>
                    </div>
                    
                    {isRecording && (
                      <div className="flex items-center gap-2 text-blue-600 mb-4">
                        <Spinner className="w-4 h-4" />
                        <span>Listening...</span>
                      </div>
                    )}
                    
                    {isTranscribingAudio && (
                      <div className="flex items-center gap-2 text-blue-600 mb-4">
                        <Spinner className="w-4 h-4" />
                        <span>Transcribing audio file...</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    All audio processing happens directly in your browser - no server needed!
                  </div>
                </div>
                
                {/* Always show transcription area */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transcription {isRecording && <span className="text-xs text-blue-500 ml-2">(Recording in progress...)</span>}
                  </label>
                  <textarea
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    placeholder="Transcription will appear here. You can edit it if needed."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg h-40"
                  />
                  <button
                    onClick={handleSpeechSubmit}
                    disabled={!transcription.trim() || isProcessingContent}
                    className={`mt-4 px-4 py-2 rounded flex items-center justify-center ${
                      !transcription.trim() || isProcessingContent
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {isProcessingContent ? (
                      <Spinner className="w-5 h-5 mr-2" />
                    ) : null}
                    <span>Add to Knowledge Base</span>
                  </button>
                  
                  {/* Debug information */}
                  {debugInfo && (
                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700 font-mono">
                      <strong>Debug:</strong> {debugInfo}
                    </div>
                  )}
                </div>
                
                <p className="mt-4 text-sm text-gray-500">
                  Speak clearly to convert your speech to text in real-time.
                </p>
              </>
            )}
          </div>
        )}

        {/* Input Text Mode */}
        {addVideoMethod === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Text
            </label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter or paste your text here..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-40"
              disabled={isProcessingContent}
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textInput.trim() || isProcessingContent}
              className={`mt-4 px-4 py-2 rounded flex items-center justify-center ${
                !textInput.trim() || isProcessingContent
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
              Directly enter or paste text to add to your knowledge base.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddContentSection; 