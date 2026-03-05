
export interface ExamOutput {
  analysis: string;
  exam1: string;
  key1: string;
  exam2: string;
  key2: string;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface TabItem {
  id: string;
  label: string;
  content: string;
}

export interface InputData {
  type: 'text' | 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  value: string;
  name?: string;
}

export enum DifficultyLevel {
  EASIER = 'Dễ hơn (Cơ bản)',
  EQUIVALENT = 'Tương đương (Tiêu chuẩn)',
  HARDER = 'Khó hơn (Nâng cao)',
  HIGH_APPLICATION = 'Vận dụng cao (Toán thực tế)'
}
