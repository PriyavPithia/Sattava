import React, { useRef, useState, useEffect } from 'react';
import { Loader2, Upload, Youtube, FileText, Mic, MicOff, Type, Settings, X } from 'lucide-react';
import axios from 'axios';

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

interface ContentAdditionProps {
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

const ContentAddition: React.FC<ContentAdditionProps> = ({
  addVideoMethod,
  setAddVideoMethod,
  url,
  setUrl,
  onAddVideo,
  onTranscriptGenerated,
  onError,
  onFileSelect,
  onTextSubmit,
  isProcessingContent
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [transcription, setTranscription] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  // For audio settings
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState<boolean>(false);

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleTextSubmit = () => {
    if (onTextSubmit && textInput.trim()) {
      onTextSubmit(textInput);
    }
  };

  const handleSpeechSubmit = () => {
    if (onTextSubmit && transcription.trim()) {
      // Create a custom event with the speech type
      const speechData = {
        text: transcription,
        type: 'speech'
      };
      
      // Pass the speech data to the parent component
      onTextSubmit(JSON.stringify(speechData));
      
      // Reset the transcription
      setTranscription('');
    }
  };

  // Check browser compatibility on component mount
  useEffect(() => {
    // Check if SpeechRecognition is supported
    const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSpeechSupported(isSupported);
    
    if (!isSupported) {
      console.error('SpeechRecognition is not supported in this browser');
      onError('Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.');
      setDebugInfo('SpeechRecognition API not supported in this browser');
    } else {
      setDebugInfo('SpeechRecognition API supported');
      
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
        let interimTranscript = '';
        let finalTranscript = '';
        
        try {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }
          
          setDebugInfo(`Got result: ${finalTranscript || interimTranscript}`);
          
          setTranscription(prevTranscript => {
            const newTranscript = prevTranscript + finalTranscript;
            return newTranscript;
          });
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
    setTranscription('');
    setDebugInfo('Transcription cleared');
  };

  // Load available audio input devices
  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        // First request permission to access media devices
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Then enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        console.log('Available audio input devices:', audioInputs);
        setAudioDevices(audioInputs);
        
        // Set default device if available
        if (audioInputs.length > 0) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error loading audio devices:', error);
        setDebugInfo(`Audio device error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    loadAudioDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices);
    };
  }, []);

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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Add to Knowledge Base</h1>
      
      <div className="space-y-6">
        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 mb-6">
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

        {/* YouTube Tab */}
        {addVideoMethod === 'youtube' && (
        <div>
          <h2 className="text-sm font-medium mb-2">YouTube URL</h2>
            <div className="flex">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 border border-gray-300 rounded-l px-4 py-2"
          />
        <button
          onClick={onAddVideo}
          disabled={isProcessingContent}
                className="px-4 py-2 bg-blue-600 text-white rounded-r"
              >
                Process
              </button>
            </div>
          </div>
        )}

        {/* Files Tab */}
        {addVideoMethod === 'files' && (
          <div>
            <h2 className="text-sm font-medium mb-2">Upload File (PDF, Text, PowerPoint)</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf,.txt,.ppt,.pptx,.doc,.docx"
                onChange={onFileSelect}
                className="hidden"
                ref={fileInputRef}
              />
              {isProcessingContent ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
            <p className="mt-2 text-sm text-gray-500">
              Upload PDF, text files (.txt), PowerPoint (.ppt, .pptx), or Word documents (.doc, .docx).
            </p>
          </div>
        )}

        {/* Speech to Text Tab */}
        {addVideoMethod === 'speech' && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-medium">Speech to Text</h2>
              <button 
                onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <Settings className="w-4 h-4 mr-1" />
                <span>Audio Settings</span>
              </button>
            </div>
            
            {/* Device Settings */}
            {showDeviceSettings && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Microphone
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {audioDevices.length === 0 ? (
                    <option value="">No microphones found</option>
                  ) : (
                    audioDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the microphone you want to use for recording.
                </p>
              </div>
            )}
            
            {!isSpeechSupported ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-700">
                  Speech recognition is not supported in your browser. Please try Chrome, Edge, or Safari.
                </p>
              </div>
            ) : (
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
                    <div className="flex items-center gap-2 text-blue-600 mb-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Listening...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
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
                disabled={isTranscribing}
              />
              <button
                onClick={handleSpeechSubmit}
                disabled={!transcription.trim() || isTranscribing || isProcessingContent}
                className={`mt-4 px-4 py-2 rounded flex items-center justify-center ${
                  !transcription.trim() || isTranscribing || isProcessingContent
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isProcessingContent ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
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
            
            <p className="mt-2 text-sm text-gray-500">
              Speak clearly to convert your speech to text in real-time.
            </p>
          </div>
        )}

        {/* Input Text Tab */}
        {addVideoMethod === 'text' && (
          <div>
            <h2 className="text-sm font-medium mb-2">Enter Text</h2>
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
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : null}
              <span>Add to Knowledge Base</span>
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Directly enter or paste text to add to your knowledge base.
            </p>
          </div>
        )}
      </div>

      {isProcessingContent && addVideoMethod !== 'files' && addVideoMethod !== 'speech' && addVideoMethod !== 'text' && (
        <div className="mt-4 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Processing content...</p>
        </div>
      )}
    </div>
  );
};

export default ContentAddition; 