import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { WebhookStorage } from "./storage";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/", (c) => {
  return c.text(`Webhook proxy → ${c.env.FORWARD_URL}`);
});

app.get("/api/endpoints", async (c) => {
  const storage = new WebhookStorage(c.env.WEBHOOK_EVENTS);
  const endpoints = await storage.getEndpoints();
  return c.json(endpoints);
});

app.get("/api/events", async (c) => {
  const storage = new WebhookStorage(c.env.WEBHOOK_EVENTS);
  const endpoint = c.req.query("endpoint");
  const limit = parseInt(c.req.query("limit") || "100");

  const events = endpoint
    ? await storage.getEventsByEndpoint(endpoint, limit)
    : await storage.getAllEvents(limit);

  return c.json(events);
});

app.get("/api/events/:id", async (c) => {
  const storage = new WebhookStorage(c.env.WEBHOOK_EVENTS);
  const event = await storage.getEvent(c.req.param("id"));

  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }

  return c.json(event);
});

async function handleWebhook(c: any) {
  const storage = new WebhookStorage(c.env.WEBHOOK_EVENTS);
  const path = c.req.path;
  const query = c.req.url.split("?")[1] || "";
  const targetUrl = `${c.env.FORWARD_URL}${path}${query ? `?${query}` : ""}`;

  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value: string, key: string) => {
    if (key !== "host" && !key.startsWith("cf-") && key !== "x-forwarded-proto" && key !== "x-real-ip") {
      headers[key] = value;
    }
  });

  const body = await c.req.text();

  const eventData = {
    endpoint: path,
    method: c.req.method,
    headers,
    body: body || null,
    query,
    ip: c.req.header("cf-connecting-ip") || null,
  };

  try {
    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body: body || undefined,
    });

    const responseBody = await response.text();

    storage.saveEvent({
      ...eventData,
      response: {
        status: response.status,
        body: responseBody || null,
      },
    });

    return new Response(responseBody, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    storage.saveEvent({
      ...eventData,
      response: {
        status: 502,
        body: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return c.json({
      error: "Forward failed",
      message: error instanceof Error ? error.message : "Unknown error",
      stored: true,
    }, 502);
  }
}

app.all("/*", (c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.notFound();
  }
  return handleWebhook(c);
});

export default app;
