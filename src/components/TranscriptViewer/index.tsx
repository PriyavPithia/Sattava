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
  highlightedTimestamp?: string;
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
  highlightedTimestamp,
}) => {
  const { highlightedReference } = useHighlight();
  const transcriptRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<any[]>([]);

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

  // Updated isHighlighted function to work with all grouping types
  const isHighlighted = (segment: any): boolean => {
    if (!highlightedReference?.source?.type || highlightedReference.source.type !== 'youtube') {
      return false;
    }

    const location = highlightedReference.source.location as ContentLocation | undefined;
    if (!location || location.type !== 'timestamp') return false;

    const refSeconds = getTimestampInSeconds(location.value);
    if (isNaN(refSeconds)) return false;

    // Handle both grouped and ungrouped segments
    const segmentStart = segment.start || segment.startTime || 0;
    const segmentEnd = segment.end || 
                      (segment.startTime + (segment.duration || 0)) || 
                      (segmentStart + (segment.duration || 0));

    // Add a small buffer (e.g., 1 second) to handle exact matches
    return refSeconds >= Math.floor(segmentStart) && 
           refSeconds <= Math.ceil(segmentEnd);
  };

  const findChunkByTimestamp = (timestamp: number) => {
    console.log('DEBUG: Finding chunk for timestamp:', timestamp);
    console.log('DEBUG: Available chunks:', transcriptChunks);
    
    // First try exact match
    let matchingChunk = transcriptChunks.find(chunk => {
      const start = chunk.startTime || chunk.start || 0;
      const end = chunk.endTime || 
                 (chunk.startTime + (chunk.duration || 0)) || 
                 (chunk.start + (chunk.duration || 0));
      
      const isMatch = timestamp >= Math.floor(start) && timestamp <= Math.ceil(end);
      console.log('DEBUG: Checking chunk:', { start, end, isMatch });
      return isMatch;
    });

    // If no exact match, find the closest chunk
    if (!matchingChunk) {
      console.log('DEBUG: No exact match, finding closest chunk');
      matchingChunk = transcriptChunks.reduce((closest, current) => {
        const currentStart = current.startTime || current.start || 0;
        const closestStart = closest ? (closest.startTime || closest.start || 0) : Infinity;
        
        return Math.abs(currentStart - timestamp) < Math.abs(closestStart - timestamp) 
          ? current 
          : closest;
      }, null);
    }

    console.log('DEBUG: Found matching chunk:', matchingChunk);
    return matchingChunk;
  };

  // Updated scroll and highlight logic
  useEffect(() => {
    if (!highlightedReference?.source?.type || highlightedReference.source.type !== 'youtube') {
      return;
    }

    const location = highlightedReference.source.location as ContentLocation | undefined;
    if (!location || location.type !== 'timestamp') return;

    const targetSeconds = getTimestampInSeconds(location.value);
    if (isNaN(targetSeconds)) return;

    console.log('DEBUG: Processing reference with timestamp:', targetSeconds);
    
    // Find the matching chunk
    const matchingChunk = findChunkByTimestamp(targetSeconds);
    console.log('DEBUG: Found matching chunk:', matchingChunk);

    if (matchingChunk) {
      const index = matchingChunk.index;
      const element = transcriptRefs.current[index];
      
      if (element) {
        console.log('DEBUG: Scrolling to element:', element);
        
        // Ensure the container is available
        if (containerRef.current) {
          // Calculate scroll position to center the element
          const container = containerRef.current;
          const containerHeight = container.clientHeight;
          const elementTop = element.offsetTop;
          const elementHeight = element.clientHeight;
          const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
          
          // Scroll to the element
          container.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        } else {
          // Fallback to element scrollIntoView
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }

        // Apply highlight
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = '#fef3c7';

        // Remove highlight after animation
        setTimeout(() => {
          if (element) {
            element.style.backgroundColor = '';
          }
        }, 3000);

        // Seek video to the timestamp with a small delay to ensure UI updates first
        console.log('DEBUG: Seeking to timestamp:', targetSeconds);
        setTimeout(() => {
          onSeek(targetSeconds);
        }, 100);
      }
    }
  }, [highlightedReference, onSeek, transcriptChunks]);

  const handleSegmentClick = (segment: any) => {
    const timestamp = segment.start || segment.startTime || 0;
    console.log('DEBUG: Segment clicked, seeking to:', timestamp);
    onSeek(timestamp);
  };

  const handleTimestampClick = (timestamp: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent div's click
    console.log('DEBUG: Timestamp clicked, seeking to:', timestamp);
    onSeek(timestamp);
  };

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
      >
        {loadingTranscript ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-4" />
              <p className="text-gray-600 font-geist">Loading transcript...</p>
            </div>
          </div>
        ) : durationFilter === 0 ? (
          <div className="space-y-4 p-4">
            {transcripts.map((segment, index) => {
              const timestamp = formatTime(segment.start);
              const isHighlighted = highlightedTimestamp === timestamp;
              
              return (
                <div
                  key={index}
                  ref={el => transcriptRefs.current[index] = el}
                  data-timestamp={timestamp}
                  className={`p-4 rounded-lg border transition-colors ${
                    isHighlighted 
                      ? 'bg-yellow-100 border-yellow-300' 
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => onSeek(segment.start)}
                >
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-geist">
                      {timestamp}
                    </span>
                  </div>
                  <p className="text-gray-800 font-geist">{segment.text}</p>
                </div>
              );
            })}
          </div>
        ) :
          groupTranscriptsByDuration(transcripts, durationFilter)?.map((group, groupIndex) => (
            <div
              key={groupIndex}
              ref={el => transcriptRefs.current[groupIndex] = el}
              onClick={() => handleSegmentClick(group)}
              className={`p-4 rounded-lg text-sm border mb-4 transition-colors cursor-pointer
                ${isHighlighted(group) 
                  ? 'bg-yellow-100 border-yellow-300' 
                  : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
            >
              <div className="bg-red-50 text-red-600 px-3 py-1 rounded-md mb-2 font-medium inline-flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <button
                  onClick={(e) => handleTimestampClick(group.startTime, e)}
                  className="text-red-600 hover:text-red-800 hover:underline focus:outline-none focus:ring-2 focus:ring-red-300 rounded px-1 font-geist"
                >
                  {formatTime(group.startTime)}
                </button>
              </div>
              <p className="text-gray-800 font-geist">{group.text}</p>
            </div>
          ))
        }
      </div>
    </div>
  );
};

export default TranscriptViewer; 