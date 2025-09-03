import { getPayload } from 'payload'

import { getPluginOptions } from '../index.js'
import { BeforeDashboardClientCached } from './BeforeDashboardClientCached.js'

export const BeforeDashboardServer = async () => {
  const pluginOptions = getPluginOptions()

  if (!pluginOptions) {
    return <div>HubSpot integration not properly configured</div>
  }

  try {
    // Fetch ALL HubSpot forms and merge with cached analytics from manually added forms
    const apiKey = pluginOptions.apiKey || process.env.HUBSPOT_API_KEY
    if (!apiKey) {
      return <div>HubSpot API key not configured</div>
    }

    // Get all forms from HubSpot
    const response = await fetch('https://api.hubapi.com/forms/v2/forms', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HubSpot API failed with status ${response.status}`)
    }

    const allHubSpotForms = await response.json()

    // Get manually added forms from database to merge analytics
    const payload = await getPayload({ config: {} as never })
    const { docs: manuallyAddedForms } = await payload.find({
      collection: 'hubspot-forms',
      limit: 1000,
    })

    // Create a map of manually added forms for quick lookup
    const manualFormsMap = new Map(manuallyAddedForms.map((form) => [form.formId, form]))

    // Transform ALL HubSpot forms with analytics where available
    const transformedForms = allHubSpotForms.map((hubspotForm: { guid: string; name: string }) => {
      const manualForm = manualFormsMap.get(hubspotForm.guid)

      return {
        name: hubspotForm.name,
        analytics: manualForm?.analytics
          ? {
              clickThroughRate: manualForm.analytics.clickThroughRate,
              conversionRate: manualForm.analytics.conversionRate,
              interactions: manualForm.analytics.interactions,
              lastUpdated: manualForm.analytics.lastUpdated,
              nonContactSubmissions: manualForm.analytics.nonContactSubmissions,
              submissionRate: manualForm.analytics.submissionRate,
              submissions: manualForm.analytics.submissions,
              views: manualForm.analytics.views,
            }
          : undefined,
        guid: hubspotForm.guid,
        isTracked: !!manualForm, // Whether this form is manually added for tracking
      }
    })

    return <BeforeDashboardClientCached forms={transformedForms} />
  } catch (_err) {
    return <div>Failed to load HubSpot forms. Please check your API configuration.</div>
  }
}
