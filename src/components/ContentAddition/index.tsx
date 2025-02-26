import React, { useRef, useState, useEffect } from 'react';
import { Loader2, Upload, Youtube, FileText, Mic, Type, Square, Pause, Play, Settings } from 'lucide-react';
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
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const recordingTimerRef = useRef<number | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  // Function to start audio visualization
  const startAudioVisualization = (stream: MediaStream) => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Create buffer
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      
      // Connect stream to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Start visualization loop
      const updateAudioLevel = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        // Calculate average level
        const average = dataArrayRef.current.reduce((acc, val) => acc + val, 0) / dataArrayRef.current.length;
        setAudioLevel(average);
        
        // Continue loop
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
    } catch (error) {
      console.error('Error setting up audio visualization:', error);
    }
  };

  // Function to stop audio visualization
  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    dataArrayRef.current = null;
    setAudioLevel(0);
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
      
      console.log('Requesting microphone access with device ID:', selectedDeviceId);
      const constraints = {
        audio: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId } } 
          : true
      };
      
      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Microphone access granted, stream tracks:', stream.getAudioTracks().length);
      
      // Store stream for later use
      setAudioStream(stream);
      
      // Start audio visualization
      startAudioVisualization(stream);
      
      // Create media recorder with explicit MIME type
      const options = { mimeType: 'audio/webm' };
      let recorder: MediaRecorder;
      
      try {
        recorder = new MediaRecorder(stream, options);
        console.log('Created MediaRecorder with options:', options);
      } catch (e) {
        console.error('Failed to create MediaRecorder with audio/webm, trying without MIME type');
        recorder = new MediaRecorder(stream);
        console.log('Created MediaRecorder without options');
      }
      
      setMediaRecorder(recorder);
      
      // Reset recording time and chunks
      setRecordingTime(0);
      setAudioChunks([]);
      
      const chunks: Blob[] = [];
      
      // Set up event handlers
      recorder.ondataavailable = (e) => {
        console.log('Data available from recorder', e.data.size);
        if (e.data.size > 0) {
          chunks.push(e.data);
          setAudioChunks(prevChunks => [...prevChunks, e.data]);
          console.log('Updated audio chunks, total chunks:', chunks.length);
        }
      };
      
      recorder.onstart = () => {
        console.log('MediaRecorder started');
      };
      
      recorder.onpause = () => {
        console.log('MediaRecorder paused');
      };
      
      recorder.onresume = () => {
        console.log('MediaRecorder resumed');
      };
      
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        onError('Recording error: ' + (event.error ? event.error.message : 'Unknown error'));
      };
      
      recorder.onstop = async () => {
        console.log('MediaRecorder stopped, processing chunks', chunks.length);
        
        // Only process if we have audio chunks
        if (chunks.length > 0) {
          setIsTranscribing(true);
          
          try {
            // Create a blob from all chunks
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            console.log('Created audio blob', audioBlob.size, 'bytes');
            
            // Create audio element for debugging
            const audioURL = URL.createObjectURL(audioBlob);
            console.log('Audio URL created:', audioURL);
            
            const audioElement = document.createElement('audio');
            audioElement.src = audioURL;
            audioElement.controls = true;
            document.body.appendChild(audioElement);
            console.log('Audio element added to body for debugging');
            
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
              console.log('Transcription updated');
            } else {
              console.error('No transcription in response:', response.data);
              onError('Failed to transcribe audio: No transcription returned');
            }
            
            // Clean up
            document.body.removeChild(audioElement);
            URL.revokeObjectURL(audioURL);
          } catch (error) {
            console.error('Error transcribing audio:', error);
            onError('Failed to transcribe audio: ' + (error instanceof Error ? error.message : 'Unknown error'));
          } finally {
            setIsTranscribing(false);
          }
        } else {
          console.warn('No audio chunks collected during recording');
          onError('No audio was recorded. Please try again.');
        }
        
        // Stop audio visualization
        stopAudioVisualization();
      };
      
      // Start recording with smaller time slices for more frequent ondataavailable events
      console.log('Starting recorder...');
      recorder.start(1000); // Collect in 1-second chunks
      setIsRecording(true);
      setIsPaused(false);
      console.log('Recorder started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      onError('Failed to access microphone: ' + (error instanceof Error ? error.message : 'Unknown error'));
      stopAudioVisualization();
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
    console.log('stopRecording called, recorder state:', mediaRecorder?.state);
    if (mediaRecorder && isRecording) {
      try {
        mediaRecorder.stop();
        console.log('MediaRecorder stopped');
      } catch (error) {
        console.error('Error stopping MediaRecorder:', error);
      }
      
      setIsRecording(false);
      setIsPaused(false);
      
      // Stop all tracks on the stream
      if (audioStream) {
        audioStream.getTracks().forEach(track => {
          track.stop();
          console.log('Audio track stopped');
        });
        setAudioStream(null);
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

  // Timer for recording duration
  useEffect(() => {
    if (isRecording && !isPaused) {
      // Start or resume timer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (recordingTimerRef.current) {
      // Pause or stop timer
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    // Reset timer when recording stops
    if (!isRecording) {
      setRecordingTime(0);
    }
    
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
        try {
          mediaRecorder.stop();
        } catch (error) {
          console.error('Error stopping MediaRecorder on unmount:', error);
        }
      }
      
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      
      stopAudioVisualization();
    };
  }, [mediaRecorder, audioStream]);

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
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              {isTranscribing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="mt-2 text-sm text-gray-600">Transcribing audio...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  {isRecording ? (
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-4 mb-2">
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
                      <div className="flex items-center justify-center w-full mb-2">
                        <div className={`h-4 w-4 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'} mr-2`}></div>
                        <span className="text-sm font-medium">
                          {isPaused ? 'Recording paused' : 'Recording'} - {formatTime(recordingTime)}
                        </span>
                      </div>
                      
                      {/* Audio level visualization */}
                      <div className="w-full max-w-xs h-8 bg-gray-100 rounded-full overflow-hidden mt-2">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-100"
                          style={{ width: `${Math.min(100, audioLevel * 100 / 255)}%` }}
                        ></div>
                      </div>
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
                        ? "Click to resume recording" 
                        : "Click to pause recording" 
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
            
            {/* Always show transcription area */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transcription {isRecording && !isPaused && !isTranscribing && <span className="text-xs text-blue-500 ml-2">(Recording in progress...)</span>}
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