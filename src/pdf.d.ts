declare module 'pdfjs-dist' {
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<PDFTextContent>;
  }

  export interface PDFTextContent {
    items: PDFTextItem[];
  }

  export interface PDFTextItem {
    str: string;
  }

  export function getDocument(data: ArrayBuffer | string): PDFDocumentLoadingTask;

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }
}

declare module 'pdfjs-dist/build/pdf' {
  export * from 'pdfjs-dist';
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
} 