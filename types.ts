export enum RobotState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR'
}

export type RobotMood = 'neutral' | 'happy' | 'concerned' | 'curious' | 'excited' | 'calm' | 'sad' | 'alert' | 'waving' | 'surprised' | 'thumbs_up' | 'facepalm' | 'shrug' | 'nervous';

export interface TranscriptionEntry {
  type: 'user' | 'robot' | 'system';
  text: string;
  timestamp: number;
}

export interface FaceBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  id: string;
}