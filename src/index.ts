import type { CollectionSlug, Config, PayloadRequest } from 'payload'
import { hubspotFormsHandler } from './utils/hubspotApi.js'

export type PayloadHubspotConfig = {
  portalId?: string
  apiKey?: string
  collections?: Partial<Record<CollectionSlug, true>>
  disabled?: boolean
}

let pluginOptionsGlobal: PayloadHubspotConfig | null = null

export const getPluginOptions = () => pluginOptionsGlobal

export const payloadHubspot =
  (pluginOptions: PayloadHubspotConfig) =>
  (config: Config): Config => {
    pluginOptionsGlobal = pluginOptions

    if (!config.collections) {
      config.collections = []
    }

    // Add HubSpot Forms collection
    config.collections.push({
      slug: 'hubspot-forms',
      admin: {
        useAsTitle: 'name',
        group: 'HubSpot Integration',
        description: 'Manage your HubSpot forms and view submissions',
      },
      fields: [
        {
          name: 'formId',
          type: 'text',
          required: true,
          label: 'HubSpot Form ID',
          unique: true,
        },
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Form Name',
          admin: {
            readOnly: true,
            description: 'Form name from HubSpot (automatically synced)',
          },
        },
      ],
      hooks: {
        beforeChange: [
          async ({ data, req }) => {
            // If formId is being updated, fetch the form name from HubSpot
            if (data.formId) {
              const apiKey = pluginOptions.apiKey || process.env.HUBSPOT_API_KEY
              if (apiKey) {
                try {
                  const response = await hubspotFormsHandler(
                    { query: {} } as PayloadRequest,
                    pluginOptions,
                  )
                  const forms = await response.json()
                  const form = forms.find((f: any) => f.guid === data.formId)
                  if (form) {
                    data.name = form.name
                  }
                } catch (error) {
                  console.error('Error fetching form name from HubSpot:', error)
                }
              }
            }
            return data
          },
        ],
      },
    })

    if (pluginOptions.collections) {
      for (const collectionSlug in pluginOptions.collections) {
        const collection = config.collections.find(
          (collection) => collection.slug === collectionSlug,
        )

        if (collection) {
          collection.fields.push({
            name: 'addedByPlugin',
            type: 'text',
            admin: {
              position: 'sidebar',
            },
          })
        }
      }
    }

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    if (!config.endpoints) {
      config.endpoints = []
    }

    // Pass the request to the handler function
    config.endpoints.push({
      handler: async (req: PayloadRequest) => {
        // Import the handler dynamically to avoid CSS import issues
        const { hubspotFormsHandler } = await import('./utils/hubspotApi.js')
        return hubspotFormsHandler(req, pluginOptions)
      },
      method: 'get',
      path: '/hubspot/forms',
    })

    if (!config.admin) {
      config.admin = {}
    }

    if (!config.admin.components) {
      config.admin.components = {}
    }

    if (!config.admin.components.beforeDashboard) {
      config.admin.components.beforeDashboard = []
    }

    // Only add the server component which will render the client component
    config.admin.components.beforeDashboard.push('payload-hubspot/rsc#BeforeDashboardServer')

    config.endpoints.push({
      handler: () => {
        return Response.json({ message: 'Hello from custom endpoint' })
      },
      method: 'get',
      path: '/my-plugin-endpoint',
    })

    const incomingOnInit = config.onInit

    config.onInit = async (payload) => {
      // Ensure we are executing any existing onInit functions before running our own.
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }

      // Sync HubSpot forms on init
      try {
        const apiKey = pluginOptions.apiKey || process.env.HUBSPOT_API_KEY
        const portalId = pluginOptions.portalId || process.env.HUBSPOT_PORTAL_ID

        if (!apiKey) {
          console.warn('HubSpot API key not found. Forms sync skipped.')
          return
        }

        const response = await fetch('https://api.hubapi.com/forms/v2/forms', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        })
        const forms = await response.json()

        for (const form of forms) {
          const { docs } = await payload.find({
            collection: 'hubspot-forms',
            where: {
              formId: {
                equals: form.guid,
              },
            },
          })

          // Only update existing forms, don't create new ones
          if (docs.length > 0) {
            await payload.update({
              collection: 'hubspot-forms',
              id: docs[0].id,
              data: {
                name: form.name,
              },
            })
          }
        }
      } catch (error) {
        console.error('Error syncing HubSpot forms:', error)
      }
    }

    return config
  }
