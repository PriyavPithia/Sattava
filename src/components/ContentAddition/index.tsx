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
}

interface ContentAdditionProps {
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
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [transcription, setTranscription] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // For audio file upload
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState<boolean>(false);

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAudioFileButtonClick = () => {
    if (audioInputRef.current) {
      audioInputRef.current.click();
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

  // Initialize speech recognition
  useEffect(() => {
    // Check if browser supports SpeechRecognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition is not supported in this browser');
      setIsSpeechSupported(false);
      return;
    }

    // Use type assertion to handle the Speech Recognition API
    const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognitionConstructor() as SpeechRecognition;
    
    if (recognitionRef.current) {
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';
  
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
  
        setTranscription(prevTranscript => {
          const newTranscript = prevTranscript + finalTranscript;
          return newTranscript;
        });
      };
  
      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error);
        onError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
      };
  
      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        // Only set isRecording to false if we didn't manually stop it
        // This prevents the recognition from stopping unexpectedly
        if (isRecording) {
          // Try to restart if it stopped unexpectedly
          try {
            if (recognitionRef.current) {
              recognitionRef.current.start();
              console.log('Restarted speech recognition after unexpected end');
            }
          } catch (error) {
            console.error('Failed to restart speech recognition', error);
            setIsRecording(false);
          }
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping speech recognition on cleanup', error);
        }
      }
    };
  }, [isRecording, onError]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    if (!recognitionRef.current) {
      onError('Speech recognition is not supported in your browser');
      return;
    }

    try {
      recognitionRef.current.start();
      console.log('Speech recognition started');
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      onError(`Failed to start speech recognition: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
        console.log('Speech recognition stopped');
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
      setIsRecording(false);
    }
  };

  const clearTranscription = () => {
    setTranscription('');
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Audio file input changed');
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log('Audio file selected:', files[0].name, files[0].type, files[0].size);
      setIsTranscribing(true);
      
      try {
        const audioFile = files[0];
        
        // Create form data
        const formData = new FormData();
        formData.append('audio', audioFile);
        
        // Send to Whisper API
        console.log('Sending audio file to Whisper API...');
        const response = await axios.post('/api/whisper-transcription', formData);
        console.log('Received response from Whisper API:', response.data);
        
        // Update transcription
        if (response.data && response.data.transcription) {
          setTranscription(response.data.transcription);
          console.log('Transcription updated successfully');
        } else {
          console.error('No transcription in response:', response.data);
          onError('Failed to transcribe audio file: No transcription returned');
        }
      } catch (error) {
        console.error('Error transcribing audio file:', error);
        if (axios.isAxiosError(error) && error.response) {
          console.error('API error details:', error.response.data);
          onError(`Failed to transcribe audio file: ${error.response.data.error || error.message}`);
        } else {
          onError(`Failed to transcribe audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } finally {
        setIsTranscribing(false);
      }
    } else {
      console.log('No audio file selected');
    }
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
      }
    };
    
    loadAudioDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices);
    };
  }, []);

  // Check browser compatibility
  useEffect(() => {
    // Check if SpeechRecognition is supported
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('SpeechRecognition is not supported in this browser');
      onError('Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.');
      setIsSpeechSupported(false);
    }
  }, [onError]);

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
                {isTranscribing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="mt-2 text-sm text-gray-600">Transcribing audio...</p>
                  </div>
                ) : (
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
                    
                    <p className="mt-1 text-xs text-gray-500">or upload an audio file</p>
                    <input
                      type="file"
                      accept="audio/*"
                      className="mt-4 text-sm hidden"
                      onChange={handleAudioFileChange}
                      ref={audioInputRef}
                    />
                    <button
                      onClick={handleAudioFileButtonClick}
                      className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                    >
                      Select Audio File
                    </button>
                  </div>
                )}
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
            </div>
            
            <p className="mt-2 text-sm text-gray-500">
              Record speech or upload an audio file to convert to text.
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