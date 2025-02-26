import { getTranscript } from '../utils/transcript';

export async function fetchYoutubeTranscript(videoId: string) {
  try {
    const transcript = await getTranscript(videoId);
    return transcript;
  } catch (error) {
    throw new Error('Failed to fetch transcript. Make sure the video exists and has captions available.');
  }
} 