export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Content {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  type: 'youtube' | 'local' | 'pdf' | 'txt' | 'ppt' | 'pptx';
  url?: string;
  content?: string;
  youtube_id?: string;
  transcript?: string;
  created_at: string;
  extracted_content?: string;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
} 