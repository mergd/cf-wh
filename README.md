# cf-wh - Webhook Proxy

Transparent proxy that forwards webhooks to cf tunnel while storing a copy for 7 days.

## URL

`$WORKERS_DEPLOY`

## How It Works

```
Webhook Provider → cf-wh Worker → wdev.fundflows.net (your tunnel)
                        ↓
                   Stored in KV
```

## Configure Webhook Providers

Point them to:

```
$WORKERS_DEPLOY/webhook/<path>
```

This forwards directly to:

```
$FORWARD_URL/<path>
```

## API (View Stored Events)

```bash
# List events
curl $WORKERS_DEPLOY/api/events

# Filter by endpoint
curl "$WORKERS_DEPLOY/api/events?endpoint=/stripe"

# Get specific event
curl $WORKERS_DEPLOY/api/events/<id>

# List endpoints
curl $WORKERS_DEPLOY/api/endpoints
```

## Deploy

```bash
bun run deploy
```
