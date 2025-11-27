export enum RecordingStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR'
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: string; // "MM:SS"
}

export interface AIAnalysis {
  title: string;
  category: string;
  tags: string[];
  summary: string[];
  decisions?: string[];
  actionItems: string[];
  participants?: string[];
  keyTopics?: string[];
  executiveSummary?: string;
  transcript: TranscriptSegment[];
}

export interface Marker {
  id: string;
  timestamp: number; // seconds
  label: string;
}

export interface Organization {
  id: string;
  name: string;
  subdomain?: string;
  slug?: string;
  logoUrl?: string;
  createdAt?: number;
}

export interface AppUser {
  id: string; // UUID from Supabase Auth
  email: string;
  organizationId: string;
  role: 'admin' | 'member';
  fullName?: string;
  createdAt?: number;
  lastLogin?: number;
}

export interface Recording {
  id: string;
  userId: string; // Linked to specific profile
  organizationId: string; // NEW: Linked to organization
  audioBlob?: Blob; // Non-persistent in this demo storage, usually upload to S3
  audioBase64?: string; // For local storage demo
  duration: number; // seconds
  createdAt: number; // Date.now()
  status: RecordingStatus;
  analysis?: AIAnalysis;
  markers: Marker[];
}

export interface UserProfile {
  id: string;
  name: string;
  role: string; // e.g., "Abogada", "Facilitador", "Lonko"
  avatarColor: string;
  organizationId: string; // NEW: Linked to organization
}

export interface ExportOptions {
  includeSummary: boolean;
  includeTranscript: boolean;
  includeActionItems: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}