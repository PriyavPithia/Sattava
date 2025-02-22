import JSZip from 'jszip';

interface PPTSlide {
  text: string;
  pageNumber: number;
}

export const extractPowerPointContent = async (file: File): Promise<PPTSlide[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = new JSZip();
    const slides: PPTSlide[] = [];
    
    // Load the PowerPoint file as a ZIP
    const zipContent = await zip.loadAsync(arrayBuffer);
    
    // Get all slide XML files
    const slideFiles = Object.keys(zipContent.files).filter(filename => 
      filename.match(/ppt\/slides\/slide[0-9]+\.xml/)
    ).sort();

    // Process each slide
    for (let i = 0; i < slideFiles.length; i++) {
      const slideXml = await zipContent.files[slideFiles[i]].async('string');
      const slideText = extractTextFromSlideXml(slideXml);
      
      if (slideText.trim()) {
        slides.push({
          text: slideText,
          pageNumber: i + 1
        });
      }
    }

    return slides;
  } catch (error) {
    console.error('Error extracting PowerPoint content:', error);
    throw new Error('Could not extract text from PowerPoint. Please try converting to PDF first.');
  }
};

function extractTextFromSlideXml(xml: string): string {
  // Extract text from various PowerPoint XML elements
  const textElements = [
    /<a:t>([^<]+)<\/a:t>/g,           // Regular text
    /<a:fld>([^<]+)<\/a:fld>/g,       // Field text
    /<a:buChar>([^<]+)<\/a:buChar>/g  // Bullet points
  ];

  let text = '';
  
  textElements.forEach(pattern => {
    const matches = xml.matchAll(pattern);
    for (const match of matches) {
      const extractedText = match[1]
        .trim()
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ');
      
      if (
        extractedText &&
        extractedText.length > 1 &&
        !/^[\d\s\.\-_]+$/.test(extractedText) &&
        !/^[A-F0-9]+$/.test(extractedText)
      ) {
        text += extractedText + '\n';
      }
    }
  });

  return text.trim();
} 