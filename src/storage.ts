import type { WebhookEvent, EndpointMetadata } from "./types";

const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

export class WebhookStorage {
  constructor(private kv: KVNamespace) {}

  async saveEvent(event: Omit<WebhookEvent, "id" | "receivedAt">): Promise<WebhookEvent> {
    const id = crypto.randomUUID();
    const receivedAt = Date.now();

    const webhookEvent: WebhookEvent = {
      id,
      ...event,
      receivedAt,
    };

    await this.kv.put(`event:${id}`, JSON.stringify(webhookEvent), {
      expirationTtl: ONE_WEEK_SECONDS,
    });

    await this.addEventToEndpointIndex(event.endpoint, id);
    await this.updateEndpointMetadata(event.endpoint);

    return webhookEvent;
  }

  async getEvent(id: string): Promise<WebhookEvent | null> {
    const data = await this.kv.get(`event:${id}`, "text");
    return data ? JSON.parse(data) : null;
  }

  async getEventsByEndpoint(endpoint: string, limit: number = 100): Promise<WebhookEvent[]> {
    const indexData = await this.kv.get(`index:${endpoint}`, "text");
    if (!indexData) return [];

    const eventIds: string[] = JSON.parse(indexData);
    const recentIds = eventIds.slice(0, limit);

    const events = await Promise.all(
      recentIds.map((id) => this.getEvent(id))
    );

    return events.filter((e): e is WebhookEvent => e !== null);
  }

  async getAllEvents(limit: number = 100): Promise<WebhookEvent[]> {
    const list = await this.kv.list({ prefix: "event:" });
    const keys = list.keys.slice(0, limit);

    const events = await Promise.all(
      keys.map(async (key) => {
        const data = await this.kv.get(key.name, "text");
        return data ? JSON.parse(data) : null;
      })
    );

    return events
      .filter((e): e is WebhookEvent => e !== null)
      .sort((a, b) => b.receivedAt - a.receivedAt);
  }

  async getEndpoints(): Promise<EndpointMetadata[]> {
    const list = await this.kv.list({ prefix: "meta:" });
    
    const metadata = await Promise.all(
      list.keys.map(async (key) => {
        const data = await this.kv.get(key.name, "text");
        return data ? JSON.parse(data) : null;
      })
    );

    return metadata
      .filter((m): m is EndpointMetadata => m !== null)
      .sort((a, b) => b.lastEventAt - a.lastEventAt);
  }

  private async addEventToEndpointIndex(endpoint: string, eventId: string) {
    const key = `index:${endpoint}`;
    const existing = await this.kv.get(key, "text");
    const eventIds: string[] = existing ? JSON.parse(existing) : [];
    
    eventIds.unshift(eventId);
    
    if (eventIds.length > 1000) {
      eventIds.splice(1000);
    }

    await this.kv.put(key, JSON.stringify(eventIds), {
      expirationTtl: ONE_WEEK_SECONDS,
    });
  }

  private async updateEndpointMetadata(endpoint: string) {
    const key = `meta:${endpoint}`;
    const existing = await this.kv.get(key, "text");
    const meta: EndpointMetadata = existing
      ? JSON.parse(existing)
      : { endpoint, lastEventAt: 0, eventCount: 0 };

    meta.lastEventAt = Date.now();
    meta.eventCount += 1;

    await this.kv.put(key, JSON.stringify(meta), {
      expirationTtl: ONE_WEEK_SECONDS,
    });
  }
}
