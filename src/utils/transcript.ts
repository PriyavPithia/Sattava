import { TranscriptSegment, TranscriptGroup, CurrentGroup } from './types';

export const groupTranscriptsByDuration = (transcripts: TranscriptSegment[], duration: number = 30): TranscriptGroup[] => {
  if (!transcripts || transcripts.length === 0) return [];

  const groups: TranscriptGroup[] = [];
  let currentGroup: CurrentGroup = {
    startTime: transcripts[0].start,
    endTime: transcripts[0].start + duration,
    texts: []
  };

  transcripts.forEach((segment) => {
    if (segment.start <= currentGroup.endTime) {
      currentGroup.texts.push(segment.text);
    } else {
      if (currentGroup.texts.length > 0) {
        groups.push({
          startTime: currentGroup.startTime,
          endTime: currentGroup.endTime,
          text: currentGroup.texts.join(' ')
        });
      }
      currentGroup = {
        startTime: segment.start,
        endTime: segment.start + duration,
        texts: [segment.text]
      };
    }
  });

  if (currentGroup.texts.length > 0) {
    groups.push({
      startTime: currentGroup.startTime,
      endTime: currentGroup.endTime,
      text: currentGroup.texts.join(' ')
    });
  }

  return groups;
};

export const calculateTotalDuration = (transcripts: TranscriptSegment[]): number => {
  if (!transcripts || transcripts.length === 0) return 0;
  const lastSegment = transcripts[transcripts.length - 1];
  return lastSegment.start + lastSegment.duration;
};

export const formatTime = (seconds: number): string => {
  if (typeof seconds !== 'number') return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const formatDurationLabel = (duration: number): string => {
  const minutes = Math.floor(duration / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}; 