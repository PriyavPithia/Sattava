import React, { useState, useEffect, useRef } from 'react';
import YoutubePlayer from './YoutubePlayer';
import { formatTime } from '../utils/youtube';

interface TranscriptSegment {
  text: string;
  offset: number; // in milliseconds
  duration: number; // in milliseconds
  start?: number; // in seconds
}

interface YoutubeTranscriptViewerProps {
  videoId: string;
  transcript: TranscriptSegment[];
  onClose?: () => void;
}

const YoutubeTranscriptViewer: React.FC<YoutubeTranscriptViewerProps> = ({
  videoId,
  transcript,
  onClose
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Initialize segment refs array
  useEffect(() => {
    segmentRefs.current = segmentRefs.current.slice(0, transcript.length);
  }, [transcript]);

  // Update active segment based on current time
  useEffect(() => {
    const timeInMs = currentTime * 1000;
    
    const newActiveIndex = transcript.findIndex((segment, index) => {
      const segmentStart = segment.offset;
      const segmentEnd = segmentStart + segment.duration;
      
      // Check if current time is within this segment
      return timeInMs >= segmentStart && timeInMs < segmentEnd;
    });
    
    if (newActiveIndex !== -1 && newActiveIndex !== activeSegmentIndex) {
      setActiveSegmentIndex(newActiveIndex);
      
      // Scroll to active segment
      if (segmentRefs.current[newActiveIndex] && transcriptContainerRef.current) {
        segmentRefs.current[newActiveIndex]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentTime, transcript, activeSegmentIndex]);

  // Handle seeking to a specific segment
  const handleSegmentClick = (segment: TranscriptSegment) => {
    const timeInSeconds = segment.offset / 1000;
    setCurrentTime(timeInSeconds);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full h-full">
      {/* Video player */}
      <div className="w-full md:w-2/3 h-[300px] md:h-[450px]">
        <YoutubePlayer 
          videoId={videoId} 
          currentTime={currentTime}
          onSeek={setCurrentTime}
        />
      </div>
      
      {/* Transcript panel */}
      <div className="w-full md:w-1/3 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">Transcript</h3>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          )}
        </div>
        
        <div 
          ref={transcriptContainerRef}
          className="flex-1 overflow-y-auto max-h-[400px] border border-gray-200 rounded-md p-3"
        >
          {transcript.length > 0 ? (
            <div className="space-y-2">
              {transcript.map((segment, index) => {
                const timeInSeconds = segment.offset / 1000;
                
                return (
                  <div
                    key={`${index}-${segment.offset}`}
                    ref={el => segmentRefs.current[index] = el}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      activeSegmentIndex === index 
                        ? 'bg-gray-200' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => handleSegmentClick(segment)}
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      {formatTime(timeInSeconds)}
                    </div>
                    <div className="text-sm">{segment.text}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              No transcript available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default YoutubeTranscriptViewer; 