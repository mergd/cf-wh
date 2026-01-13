export interface WebhookEvent {
  id: string;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  query: string;
  ip: string | null;
  receivedAt: number;
  response?: {
    status: number;
    body: string | null;
  };
}

export interface Env {
  WEBHOOK_EVENTS: KVNamespace;
  FORWARD_URL: string;
}

export interface EndpointMetadata {
  endpoint: string;
  lastEventAt: number;
  eventCount: number;
}
