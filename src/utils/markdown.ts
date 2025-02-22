import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const processMarkdown = (content: string): string => {
  const renderer = new marked.Renderer();
  
  renderer.heading = (text, level) => {
    const processedText = text.replace(/{ref: \d{2}:\d{2}}/, '');
    const timestamp = text.match(/{ref: (\d{2}:\d{2})}/)?.[1];
    
    const headingClass = level === 1 
      ? 'text-3xl font-bold mb-6' 
      : 'text-2xl font-bold mt-8 mb-4';
    
    return `<h${level} class="${headingClass} flex items-center gap-2">
      ${processedText}
      ${timestamp ? `<button 
        class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
        onclick="window.handleTimestampClick('${timestamp}')"
        title="Jump to ${timestamp}"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-600">
          <path d="M7 17L17 7M17 7H7M17 7V17"/>
        </svg>
      </button>` : ''}
    </h${level}>`;
  };

  marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  });

  return DOMPurify.sanitize(marked.parse(content) as string);
}; 