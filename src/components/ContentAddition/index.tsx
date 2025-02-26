import React, { useRef, useState, useEffect } from 'react';
import { Loader2, Upload, Youtube, FileText, Mic, Type, Square, Pause, Play } from 'lucide-react';
import axios from 'axios';

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
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

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
      setAudioChunks([]);
    }
  };

  const startRecording = async () => {
    console.log('startRecording function called');
    try {
      // Check if we have microphone permission
      const permissionStatus = await checkMicrophonePermission();
      if (!permissionStatus) {
        console.error('Microphone permission denied');
        onError('Microphone access denied. Please allow microphone access in your browser settings.');
        return;
      }
      
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted, creating MediaRecorder');
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        console.log('Data available from recorder', e.data.size);
        if (e.data.size > 0) {
          chunks.push(e.data);
          setAudioChunks([...chunks]);
        }
      };
      
      recorder.onstop = async () => {
        console.log('Recorder stopped, processing chunks', chunks.length);
        // Only process if we have audio chunks
        if (chunks.length > 0) {
          setIsTranscribing(true);
          
          try {
            // Create a blob from all chunks
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            console.log('Created audio blob', audioBlob.size);
            
            // Create form data
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            
            // Send to Whisper API
            console.log('Sending to Whisper API...');
            const response = await axios.post('/api/whisper-transcription', formData);
            console.log('Received response from Whisper API', response.data);
            
            // Update transcription
            if (response.data && response.data.transcription) {
              setTranscription(prev => prev + ' ' + response.data.transcription);
            }
          } catch (error) {
            console.error('Error transcribing audio:', error);
            onError('Failed to transcribe audio');
          } finally {
            setIsTranscribing(false);
          }
        }
      };
      
      console.log('Starting recorder...');
      recorder.start(5000); // Collect in 5-second chunks
      setIsRecording(true);
      setIsPaused(false);
      console.log('Recorder started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      onError('Failed to access microphone');
    }
  };

  // Function to check microphone permission
  const checkMicrophonePermission = async (): Promise<boolean> => {
    try {
      // Check if the browser supports the permissions API
      if (navigator.permissions && navigator.permissions.query) {
        console.log('Checking microphone permission using Permissions API');
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log('Permission status:', permissionStatus.state);
        
        if (permissionStatus.state === 'granted') {
          return true;
        } else if (permissionStatus.state === 'prompt') {
          // We'll get the prompt when we call getUserMedia
          return true;
        } else {
          // Permission denied
          return false;
        }
      } else {
        // Fallback for browsers that don't support the permissions API
        console.log('Permissions API not supported, will try direct access');
        return true; // We'll handle the error in getUserMedia
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return true; // Let getUserMedia handle the error
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && isRecording && isPaused) {
      mediaRecorder.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      // Stop all tracks on the stream
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
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

  // Check browser compatibility and permissions
  useEffect(() => {
    // Check if MediaRecorder is supported
    if (typeof MediaRecorder === 'undefined') {
      console.error('MediaRecorder is not supported in this browser');
      onError('Speech recording is not supported in this browser');
      return;
    }

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia is not supported in this browser');
      onError('Microphone access is not supported in this browser');
      return;
    }

    // Check if we're in a secure context (HTTPS or localhost)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      console.error('Microphone access requires a secure context (HTTPS or localhost)');
      onError('Microphone access requires a secure connection (HTTPS)');
      return;
    }

    console.log('Browser supports recording capabilities');
  }, [onError]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        
        if (mediaRecorder.stream) {
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
      }
    };
  }, [mediaRecorder]);

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
            <h2 className="text-sm font-medium mb-2">Speech to Text</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              {isTranscribing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="mt-2 text-sm text-gray-600">Transcribing audio...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  {isRecording ? (
                    <div className="flex items-center gap-4">
                      {isPaused ? (
                        <button
                          onClick={resumeRecording}
                          className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors"
                        >
                          <Play className="w-6 h-6 text-green-600" />
                        </button>
                      ) : (
                        <button
                          onClick={pauseRecording}
                          className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center hover:bg-yellow-100 transition-colors"
                        >
                          <Pause className="w-6 h-6 text-yellow-600" />
                        </button>
                      )}
                      <button
                        onClick={stopRecording}
                        className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                      >
                        <Square className="w-6 h-6 text-red-600" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        console.log('Recording button clicked');
                        startRecording();
                      }}
                      className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors"
                    >
                      <Mic className="w-10 h-10 text-blue-500" />
                    </button>
                  )}
                  <p className="mt-4 text-sm font-medium text-gray-900">
                    {isRecording 
                      ? isPaused 
                        ? "Recording paused - click to resume" 
                        : "Recording in progress - click to pause" 
                      : "Click to start recording"}
                  </p>
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
            
            {/* Real-time transcription display */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transcription
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
              Record speech or upload an audio file to convert to text using OpenAI Whisper.
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