import { extractPowerPointContent } from '../powerpoint';
import { VideoItem, ExtractedContent } from '../../components/types';

export const handlePowerPointFile = async (
  file: File,
  selectedCollection: { id: string }
): Promise<{
  newItem: VideoItem;
  extractedContent: ExtractedContent[];
  content: string;
}> => {
  const fileType = file.name.endsWith('.ppt') ? 'ppt' as const : 'pptx' as const;
  const slides = await extractPowerPointContent(file);
  const extractedContent = slides;
  const content = slides.map(slide => slide.text).join('\n\n');

  const newItem: VideoItem = {
    id: `file-${Date.now()}`,
    url: URL.createObjectURL(file),
    title: file.name,
    type: fileType,
    content: content
  };

  return {
    newItem,
    extractedContent,
    content
  };
};

export const isPowerPointFile = (file: File): boolean => {
  return (
    file.type === 'application/vnd.ms-powerpoint' || 
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.name.endsWith('.ppt') ||
    file.name.endsWith('.pptx')
  );
}; 