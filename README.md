# Payload HubSpot Plugin

A PayloadCMS plugin for HubSpot integration - view and manage HubSpot forms directly in your Payload admin dashboard.

## Features

- 📊 **Dashboard Overview**: View all your HubSpot forms with key metrics directly in your Payload admin dashboard
- 📈 **Form Analytics**: See views, submissions, and conversion rates for each form
- 🔄 **Auto-Sync**: Forms are automatically synced with HubSpot on server startup
- 📋 **Form Management**: Create and manage HubSpot form connections in Payload
- 🔌 **Easy Integration**: Simple configuration with minimal setup required

## Installation

```bash
# npm
npm install payload-hubspot

# yarn
yarn add payload-hubspot

# pnpm
pnpm add payload-hubspot
```

## Usage

### Basic Setup

Add the plugin to your Payload config:

```typescript
import { buildConfig } from 'payload/config'
import { payloadHubspot } from 'payload-hubspot'

export default buildConfig({
  // ... your existing config
  plugins: [
    payloadHubspot({
      apiKey: process.env.HUBSPOT_API_KEY, // Your HubSpot API key
    }),
  ],
})
```

### Environment Variables

Add these to your `.env` file:

```
HUBSPOT_API_KEY=your-hubspot-api-key
```

### Configuration Options

The plugin accepts the following options:

```typescript
type PayloadHubspotConfig = {
  apiKey?: string // Your HubSpot API key (can also be set via env var)
  collections?: Partial<Record<CollectionSlug, true>> // Collections to add HubSpot fields to
  disabled?: boolean // Set to true to disable the plugin functionality
}
```

### Full Example

```typescript
import { buildConfig } from 'payload/config'
import { payloadHubspot } from 'payload-hubspot'

export default buildConfig({
  // ... your existing config
  plugins: [
    payloadHubspot({
      apiKey: process.env.HUBSPOT_API_KEY,
      collections: {
        pages: true,
        posts: true,
      },
    }),
  ],
})
```

## Features

### Dashboard Widget

The plugin adds a dashboard widget to your Payload admin panel that displays:

- Total number of forms
- Total form views
- Total form submissions
- Average conversion rate
- A table of all forms with their individual metrics

### HubSpot Forms Collection

The plugin creates a `hubspot-forms` collection in your Payload CMS with the following fields:

- `formId`: The HubSpot form GUID
- `name`: The form name (automatically synced from HubSpot)

### API Endpoints

The plugin adds the following API endpoints:

- `GET /api/hubspot/forms`: Returns a list of all HubSpot forms with their statistics
  - Add `?refresh=true` to force a refresh of the cache

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/payload-hubspot.git
cd payload-hubspot

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

### Building

```bash
pnpm build
```

### Testing

```bash
pnpm test
```
