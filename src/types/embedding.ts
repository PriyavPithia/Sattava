export interface ChunkEmbedding {
  text: string;
  embedding: number[];
}

export interface TranscriptResponse {
  transcripts: {
    start: number;
    duration: number;
    text: string;
  }[];
} 