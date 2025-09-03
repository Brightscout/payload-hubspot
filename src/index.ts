import type { CollectionSlug, Config, PayloadRequest } from 'payload'

// Removed unused import - forms are now managed manually

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
        description:
          'Add HubSpot forms you want to track. Enter the Form ID and the name will be fetched automatically. No forms are added without your action.',
        group: 'Integrations',
        useAsTitle: 'name',
      },
      fields: [
        {
          name: 'formId',
          type: 'text',
          admin: {
            description:
              'Enter the HubSpot form GUID. The form name will be automatically fetched.',
          },
          label: 'HubSpot Form ID',
          required: true,
          unique: true,
        },
        {
          name: 'name',
          type: 'text',
          admin: {
            description:
              'Form name from HubSpot (automatically fetched when you enter the Form ID)',
            readOnly: true,
          },
          label: 'Form Name',
          required: true,
        },
        {
          name: 'analytics',
          type: 'group',
          admin: {
            description: 'Cached analytics data from HubSpot',
          },
          fields: [
            {
              name: 'views',
              type: 'number',
              admin: {
                readOnly: true,
              },
              defaultValue: 0,
            },
            {
              name: 'submissions',
              type: 'number',
              admin: {
                readOnly: true,
              },
              defaultValue: 0,
            },
            {
              name: 'conversionRate',
              type: 'number',
              admin: {
                readOnly: true,
              },
            },
            {
              name: 'clickThroughRate',
              type: 'number',
              admin: {
                readOnly: true,
              },
              defaultValue: 0,
            },
            {
              name: 'interactions',
              type: 'number',
              admin: {
                readOnly: true,
              },
              defaultValue: 0,
            },
            {
              name: 'submissionRate',
              type: 'number',
              admin: {
                readOnly: true,
              },
              defaultValue: 0,
            },
            {
              name: 'nonContactSubmissions',
              type: 'number',
              admin: {
                readOnly: true,
              },
              defaultValue: 0,
            },
            {
              name: 'lastUpdated',
              type: 'date',
              admin: {
                readOnly: true,
              },
            },
          ],
        },
      ],
      hooks: {
        beforeChange: [
          async ({ data, operation }) => {
            // Only fetch form name when user is manually creating a new form entry
            if (data.formId && operation === 'create' && !data.name) {
              const apiKey = pluginOptions.apiKey || process.env.HUBSPOT_API_KEY
              if (apiKey) {
                try {
                  // Fetch form details directly from HubSpot to validate and get name
                  const response = await fetch('https://api.hubapi.com/forms/v2/forms', {
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      'Content-Type': 'application/json',
                    },
                  })

                  if (response.ok) {
                    const forms = await response.json()
                    const form = forms.find(
                      (f: { guid: string; name: string }) => f.guid === data.formId,
                    )
                    if (form) {
                      data.name = form.name
                    } else {
                      // Form not found in HubSpot
                      throw new Error(
                        `Form with ID ${data.formId} not found in HubSpot. Please check the Form ID.`,
                      )
                    }
                  } else {
                    throw new Error('Unable to connect to HubSpot API to validate form ID')
                  }
                } catch (error) {
                  // If we can't fetch the form name, let the user know
                  throw new Error(
                    `Unable to validate form ID with HubSpot: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  )
                }
              } else {
                throw new Error('HubSpot API key not configured. Cannot validate form ID.')
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

    // Get all HubSpot forms for dashboard display
    config.endpoints.push({
      handler: async (req: PayloadRequest) => {
        try {
          const apiKey = pluginOptions.apiKey || process.env.HUBSPOT_API_KEY
          if (!apiKey) {
            return new Response(JSON.stringify({ error: 'HubSpot API key not configured' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 500,
            })
          }

          // Fetch all forms from HubSpot
          const formsResponse = await fetch('https://api.hubapi.com/forms/v2/forms', {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          })

          if (!formsResponse.ok) {
            throw new Error(`HubSpot API failed with status ${formsResponse.status}`)
          }

          const allHubSpotForms = await formsResponse.json()

          // Get manually added forms from database to merge analytics
          const { getPayload } = await import('payload')
          const payload = await getPayload({ config: req.payload.config })

          const { docs: manuallyAddedForms } = await payload.find({
            collection: 'hubspot-forms',
            limit: 1000,
          })

          // Create a map of manually added forms for quick lookup
          const manualFormsMap = new Map(manuallyAddedForms.map((form) => [form.formId, form]))

          // Merge HubSpot forms with cached analytics where available
          const formsWithAnalytics = allHubSpotForms.map(
            (hubspotForm: { guid: string; name: string }) => {
              const manualForm = manualFormsMap.get(hubspotForm.guid)

              return {
                name: hubspotForm.name,
                analytics: manualForm?.analytics || null, // Cached analytics if available
                guid: hubspotForm.guid,
                isTracked: !!manualForm, // Whether this form is manually added for tracking
              }
            },
          )

          return new Response(JSON.stringify(formsWithAnalytics), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          return new Response(
            JSON.stringify({
              details: error instanceof Error ? error.message : 'Unknown error',
              error: 'Failed to fetch HubSpot forms',
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 500,
            },
          )
        }
      },
      method: 'get',
      path: '/hubspot/forms',
    })

    // Individual form analytics endpoint
    config.endpoints.push({
      handler: async (req: PayloadRequest) => {
        const { individualFormAnalyticsHandler } = await import('./utils/hubspotApi.js')
        return individualFormAnalyticsHandler(req, pluginOptions)
      },
      method: 'get',
      path: '/hubspot/form-analytics/:formGuid',
    })

    // Refresh analytics endpoint
    config.endpoints.push({
      handler: async (req: PayloadRequest) => {
        try {
          const { refreshFormAnalytics } = await import('./utils/syncFormAnalytics.js')
          const { getPayload } = await import('payload')

          const payload = await getPayload({ config: req.payload.config })
          const formId = req.routeParams?.formId as string | undefined

          await refreshFormAnalytics(payload, pluginOptions, formId)

          return new Response(
            JSON.stringify({
              message: formId
                ? `Analytics refreshed for form ${formId}`
                : 'All analytics refreshed',
              success: true,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          return new Response(
            JSON.stringify({
              details: error instanceof Error ? error.message : 'Unknown error',
              error: 'Failed to refresh analytics',
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 500,
            },
          )
        }
      },
      method: 'post',
      path: '/hubspot/refresh-analytics/:formId?',
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

      // Sync HubSpot forms on init (basic form data only, no analytics)
      try {
        const apiKey = pluginOptions.apiKey || process.env.HUBSPOT_API_KEY

        if (!apiKey) {
          // HubSpot API key not found. Forms sync skipped.
          return
        }

        // Test API connection to ensure HubSpot is accessible
        const testResponse = await fetch('https://api.hubapi.com/forms/v2/forms?limit=1', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        })

        if (!testResponse.ok) {
          throw new Error(`HubSpot API connection failed with status ${testResponse.status}`)
        }

        // API connection successful - forms will be added manually by users

        // Start background analytics sync (non-blocking)
        setTimeout(async () => {
          try {
            // Starting background analytics sync
            const { syncFormAnalytics } = await import('./utils/syncFormAnalytics.js')
            await syncFormAnalytics(payload, pluginOptions)
            // Background analytics sync completed
          } catch (_analyticsError) {
            // Error during background analytics sync - silently handled
          }
        }, 5000) // 5 second delay to let server fully initialize
      } catch (_error) {
        // Error syncing HubSpot forms - silently handled
      }
    }

    return config
  }
