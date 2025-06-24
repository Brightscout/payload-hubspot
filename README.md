# Payload HubSpot Plugin

A PayloadCMS plugin for HubSpot integration - view and manage HubSpot forms directly in your Payload admin dashboard.

## Features

- 📊 **Dashboard Overview**: View all your HubSpot forms with key metrics directly in your Payload admin dashboard
- 📈 **Form Analytics**: See comprehensive form metrics including views, submissions, conversion rates, click-through rates, and interactions
- 🔄 **Auto-Sync**: Forms are automatically synced with HubSpot on server startup
- 📋 **Form Management**: Create and manage HubSpot form connections in Payload
- 🔌 **Easy Integration**: Simple configuration with minimal setup required
- ⚡ **Smart Caching**: 1-hour cache with refresh capability for optimal performance

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
import { buildConfig } from 'payload'
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
HUBSPOT_PORTAL_ID=your-hubspot-portal-id
HUBSPOT_API_KEY=your-hubspot-api-key
```

### Configuration Options

The plugin accepts the following options:

```typescript
type PayloadHubspotConfig = {
  apiKey?: string // Your HubSpot API key (can also be set via env var)
  collections?: Partial<Record<CollectionSlug, true>> // Collections to add HubSpot fields to
  disabled?: boolean // Set to true to disable the plugin functionality
  disableDashboard?: boolean // Set to true to disable the dashboard component
}
```

### Full Example

```typescript
import { buildConfig } from 'payload'
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
      // Optional: disable dashboard component
      disableDashboard: false,
    }),
  ],
})
```

## Features

### Dashboard Component

The plugin adds a dashboard component to the HubSpot Forms collection that displays:

- Total number of forms
- Total form views
- Total form submissions
- Average conversion rate
- A sortable table of all forms with comprehensive metrics including:
  - Form views and submissions
  - Conversion rates and click-through rates
  - Form interactions and submission rates
  - Copy-to-clipboard functionality for form IDs

### HubSpot Forms Collection

The plugin creates a `hubspot-forms` collection in your Payload CMS with the following fields:

- `formId`: The HubSpot form GUID (required, unique)
- `name`: The form name (automatically synced from HubSpot, read-only)

The collection includes automatic hooks that:

- Sync form names from HubSpot when formId is updated
- Update existing forms on server startup (doesn't create new ones automatically)

### API Endpoints

The plugin adds the following API endpoints:

- `GET /api/hubspot/forms`: Returns a list of all HubSpot forms with comprehensive statistics
  - Add `?refresh=true` to force a refresh of the 1-hour cache
- `GET /api/my-plugin-endpoint`: Custom endpoint (example implementation)

### Analytics Data

Each form includes the following analytics:

- `views`: Total form views
- `submissions`: Total form submissions
- `conversionRate`: Submissions per form view (when <= 1)
- `clickThroughRate`: Click-through rate per form view
- `interactions`: Total form interactions
- `submissionRate`: Submissions per click-through
- `nonContactSubmissions`: Non-contact form submissions

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/gridig/payload-hubspot.git
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

## Requirements

- **Node.js**: ^18.20.2 || >=20.9.0
- **PayloadCMS**: ^3.29.0
- **Package Manager**: pnpm ^9 || ^10

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:

- [GitHub Issues](https://github.com/gridig/payload-hubspot/issues)
- [Package Homepage](https://github.com/gridig/payload-hubspot)
