export const extractVideoId = (url: string): string | null => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
};

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
  parts.push(minutes.toString().padStart(2, '0'));
  parts.push(secs.toString().padStart(2, '0'));

  return parts.join(':');
};

export const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  return textarea.value;
};

export interface TranscriptItem {
  text: string;
  offset: number;
  duration: number;
}

export const groupTranscriptByInterval = (items: TranscriptItem[], intervalSeconds: number): TranscriptItem[] => {
  if (intervalSeconds <= 1) return items.map(item => ({
    ...item,
    text: decodeHtmlEntities(item.text)
  }));

  const grouped: TranscriptItem[] = [];
  let currentGroup: TranscriptItem[] = [];
  let currentIntervalStart = 0;

  items.forEach((item) => {
    const itemStartSeconds = item.offset / 1000;
    
    if (itemStartSeconds >= currentIntervalStart + intervalSeconds || currentGroup.length === 0) {
      if (currentGroup.length > 0) {
        const combinedText = currentGroup.map(g => decodeHtmlEntities(g.text)).join(' ');
        const firstItem = currentGroup[0];
        const lastItem = currentGroup[currentGroup.length - 1];
        
        grouped.push({
          text: combinedText,
          offset: firstItem.offset,
          duration: (lastItem.offset + lastItem.duration) - firstItem.offset
        });
      }
      
      currentGroup = [item];
      currentIntervalStart = Math.floor(itemStartSeconds / intervalSeconds) * intervalSeconds;
    } else {
      currentGroup.push(item);
    }
  });

  // Add the last group if it exists
  if (currentGroup.length > 0) {
    const combinedText = currentGroup.map(g => decodeHtmlEntities(g.text)).join(' ');
    const firstItem = currentGroup[0];
    const lastItem = currentGroup[currentGroup.length - 1];
    
    grouped.push({
      text: combinedText,
      offset: firstItem.offset,
      duration: (lastItem.offset + lastItem.duration) - firstItem.offset
    });
  }

  return grouped;
}; 