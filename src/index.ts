import type { CollectionSlug, Config, PayloadRequest } from 'payload'

import { hubspotFormsHandler } from './utils/hubspotApi.js'

export type PayloadHubspotConfig = {
  apiKey?: string
  collections?: Partial<Record<CollectionSlug, true>>
  disabled?: boolean
  disableDashboard?: boolean
}

let pluginOptionsGlobal: null | PayloadHubspotConfig = null

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
        components: {
          beforeList: ['payload-hubspot/rsc#BeforeDashboardServer'],
        },
        description: 'Manage HubSpot forms available in your Collections',
        group: 'Integrations',
        useAsTitle: 'name',
      },
      fields: [
        {
          name: 'formId',
          type: 'text',
          label: 'HubSpot Form ID',
          required: true,
          unique: true,
        },
        {
          name: 'name',
          type: 'text',
          admin: {
            description: 'Form name from HubSpot (automatically synced)',
            readOnly: true,
          },
          label: 'Form Name',
          required: true,
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
      labels: {
        plural: 'HubSpot Forms',
        singular: 'HubSpot Form',
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
          try {
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
                id: docs[0].id,
                collection: 'hubspot-forms',
                data: {
                  name: form.name,
                },
              })
            }
          } catch (dbError) {
            // Collection doesn't exist yet, skip this form
            console.log('HubSpot forms collection not yet created. Skipping sync.')
            break
          }
        }
      } catch (error) {
        console.error('Error syncing HubSpot forms:', error)
      }
    }

    return config
  }
