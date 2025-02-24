import React, { useRef, useEffect, useState } from 'react';
import { FileText, Timer, Filter, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useHighlight } from '../../contexts/HighlightContext';
import { ContentLocation, ContentSource, CombinedContent } from '../../types';

interface TranscriptViewerProps {
  videoUrl: string;
  transcripts: any[];
  durationFilter: number;
  onDurationFilterChange: (value: number) => void;
  onSeek: (timestamp: number) => void;
  loadingTranscript: boolean;
  groupTranscriptsByDuration: (transcripts: any[], duration?: number) => any[];
  formatTime: (seconds: number) => string;
  calculateTotalDuration: (transcripts: any[]) => number;
  formatDurationLabel: (duration: number) => string;
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  videoUrl,
  transcripts,
  durationFilter,
  onDurationFilterChange,
  onSeek,
  loadingTranscript,
  groupTranscriptsByDuration,
  formatTime,
  calculateTotalDuration,
  formatDurationLabel,
}) => {
  const { highlightedReference } = useHighlight();
  const transcriptRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<any[]>([]);
  const lastProcessedRef = useRef<string | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  // Initialize transcript chunks when transcripts change
  useEffect(() => {
    const processTranscripts = () => {
      console.log('Processing transcripts with duration filter:', durationFilter);
      const chunks = durationFilter === 0 ? transcripts : groupTranscriptsByDuration(transcripts, durationFilter);
      console.log('Processed chunks:', chunks);

      const processedChunks = chunks.map((chunk, index) => {
        const startTime = typeof chunk.start === 'number' ? chunk.start : 
                         typeof chunk.startTime === 'number' ? chunk.startTime : 0;
        
        const duration = typeof chunk.duration === 'number' ? chunk.duration :
                        (chunk.endTime && chunk.startTime) ? chunk.endTime - chunk.startTime : 0;

        return {
          ...chunk,
          index,
          startTime,
          endTime: startTime + duration,
          text: chunk.text || '',
        };
      });

      setTranscriptChunks(processedChunks);
    };

    processTranscripts();
  }, [transcripts, durationFilter, groupTranscriptsByDuration]);

  // Helper function to convert timestamp to seconds
  const getTimestampInSeconds = (timeValue: string | number): number => {
    if (typeof timeValue === 'string' && timeValue.includes(':')) {
      const [minutes, seconds] = timeValue.split(':').map(Number);
      return minutes * 60 + seconds;
    }
    return Number(timeValue);
  };

  // Updated scroll and highlight logic
  useEffect(() => {
    if (!highlightedReference?.source?.type || highlightedReference.source.type !== 'youtube') {
      return;
    }

    const location = highlightedReference.source.location as ContentLocation | string;
    if (!location) return;

    // Create a unique identifier for this reference
    const refId = typeof location === 'string' ? location : location.value.toString();
    
    // If we've already processed this reference, just update highlighting without scrolling
    if (lastProcessedRef.current === refId) {
      return;
    }

    // Mark as processed and trigger scroll
    lastProcessedRef.current = refId;
    setShouldScroll(true);
  }, [highlightedReference]);

  // Separate effect for handling the actual scrolling
  useEffect(() => {
    if (!shouldScroll || !highlightedReference) return;

    const location = highlightedReference.source.location as ContentLocation | string;
    let targetSeconds: number;
    if (typeof location === 'string') {
      targetSeconds = location.includes(':') 
        ? getTimestampInSeconds(location)
        : parseInt(location, 10);
    } else {
      targetSeconds = getTimestampInSeconds(location.value);
    }

    if (isNaN(targetSeconds)) {
      setShouldScroll(false);
      return;
    }

    // Find the matching chunk
    const matchingChunk = transcriptChunks.find(chunk => {
      const start = Math.floor(chunk.startTime);
      const end = Math.ceil(chunk.endTime);
      return targetSeconds >= start && targetSeconds <= end;
    });

    if (matchingChunk && containerRef.current) {
      const index = matchingChunk.index;
      const element = transcriptRefs.current[index];
      
      if (element) {
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // Calculate the scroll position to center the element
        const scrollTop = element.offsetTop - (containerRect.height - elementRect.height);

        // Perform the scroll
        container.scrollTo({
          top: Math.max(0, scrollTop), // Prevent negative scroll
          behavior: 'smooth'
        });

        // Apply highlight animation
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = '#fef3c7';

        // Remove highlight after animation
        setTimeout(() => {
          if (element) {
            element.style.backgroundColor = '';
          }
        }, 3000);

        // Seek video to timestamp
        onSeek(targetSeconds);
      }
    }

    // Reset scroll flag
    setShouldScroll(false);
  }, [shouldScroll, highlightedReference, transcriptChunks, onSeek, getTimestampInSeconds]);

  // Reset the processed reference when chunks change
  useEffect(() => {
    lastProcessedRef.current = null;
    setShouldScroll(false);
  }, [transcriptChunks]);

  const handleSegmentClick = (segment: any) => {
    const timestamp = segment.startTime || segment.start || 0;
    console.log('DEBUG: Segment clicked, seeking to:', timestamp);
    onSeek(timestamp);
  };

  if (loadingTranscript) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-gray-600 font-geist">Loading transcript...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 h-full flex flex-col font-geist">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-600" />
          Transcript
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Timer className="w-4 h-4" />
            <span className="text-sm font-geist">
              {formatDurationLabel(calculateTotalDuration(transcripts))}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={durationFilter}
              onChange={(e) => onDurationFilterChange(Number(e.target.value))}
              className="bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-1 text-sm font-geist focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none"
            >
              <option value="0">No grouping</option>
              <option value="15">15 second chunks</option>
              <option value="30">30 second chunks</option>
              <option value="60">1 minute chunks</option>
            </select>
          </div>
        </div>
      </div>
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-gray-50 rounded-lg"
        style={{ 
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="space-y-4 p-4">
          {transcriptChunks.map((chunk, index) => {
            const location = highlightedReference?.source?.location as ContentLocation | string;
            const isHighlighted = highlightedReference?.source?.type === 'youtube' &&
              location &&
              (typeof location === 'string' 
                ? getTimestampInSeconds(location)
                : getTimestampInSeconds(location.value)
              ) >= chunk.startTime &&
              (typeof location === 'string'
                ? getTimestampInSeconds(location)
                : getTimestampInSeconds(location.value)
              ) <= chunk.endTime;

            return (
              <div
                key={index}
                ref={el => transcriptRefs.current[index] = el}
                onClick={() => handleSegmentClick(chunk)}
                className={`p-4 rounded-lg border transition-colors cursor-pointer
                  ${isHighlighted 
                    ? 'bg-yellow-100 border-yellow-300' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                data-start-time={chunk.startTime}
              >
                <div className="bg-red-50 text-red-600 px-3 py-1 rounded-md mb-2 font-medium inline-flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(chunk.startTime)}</span>
                </div>
                <p className="text-gray-800 font-geist">{chunk.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TranscriptViewer; 