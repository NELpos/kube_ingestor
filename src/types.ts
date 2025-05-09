export interface Event {
  id: string;
  data: any;
  created_at: Date;
}

export interface EventTracker {
  last_event_id: string;
  updated_at: Date;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

export interface DbConfig {
  user: string;
  host: string;
  database: string;
  password: string;
  port: number;
}
