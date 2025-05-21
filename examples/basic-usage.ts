import { buildConfig } from 'payload/config'
import { payloadHubspot } from 'payload-hubspot'
import { mongooseAdapter } from '@payloadcms/db-mongodb'

/**
 * This is a basic example of how to use the payload-hubspot plugin
 * in a PayloadCMS project.
 */
export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [
    // Your collections here
    {
      slug: 'users',
      auth: true,
      admin: {
        useAsTitle: 'email',
      },
      fields: [
        // Your user fields
      ],
    },
    {
      slug: 'pages',
      admin: {
        useAsTitle: 'title',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'content',
          type: 'richText',
        },
      ],
    },
  ],
  db: mongooseAdapter({
    url: process.env.MONGODB_URI,
  }),
  plugins: [
    payloadHubspot({
      // Option 1: Use environment variables (recommended)
      // Make sure to add this to your .env file:
      // HUBSPOT_API_KEY=your-hubspot-api-key

      // Option 2: Pass values directly (not recommended for production)
      // apiKey: 'your-hubspot-api-key',

      // Add HubSpot fields to specific collections
      collections: {
        pages: true,
      },

      // Disable the plugin (useful for development/testing)
      // disabled: process.env.NODE_ENV === 'development',
    }),
  ],
})
