import { getPayload } from 'payload'

import { getPluginOptions } from '../index.js'
import { BeforeDashboardClientCached } from './BeforeDashboardClientCached.js'

export const BeforeDashboardServer = async () => {
  const pluginOptions = getPluginOptions()

  if (!pluginOptions) {
    return <div>HubSpot integration not properly configured</div>
  }

  try {
    // Get forms from database (basic data only, no analytics)
    const payload = await getPayload({ config: {} as never })

    const { docs: forms } = await payload.find({
      collection: 'hubspot-forms',
      limit: 1000, // Adjust as needed
      sort: 'name',
    })

    // Transform to expected format with analytics
    const transformedForms = forms.map((form) => ({
      name: form.name,
      analytics: form.analytics
        ? {
            clickThroughRate: form.analytics.clickThroughRate,
            conversionRate: form.analytics.conversionRate,
            interactions: form.analytics.interactions,
            lastUpdated: form.analytics.lastUpdated,
            nonContactSubmissions: form.analytics.nonContactSubmissions,
            submissionRate: form.analytics.submissionRate,
            submissions: form.analytics.submissions,
            views: form.analytics.views,
          }
        : undefined,
      guid: form.formId,
    }))

    return <BeforeDashboardClientCached forms={transformedForms} />
  } catch (_err) {
    // Fallback: try to fetch basic forms list directly from HubSpot
    try {
      const apiKey = pluginOptions.apiKey || process.env.HUBSPOT_API_KEY
      if (!apiKey) {
        return <div>HubSpot API key not configured</div>
      }

      const response = await fetch('https://api.hubapi.com/forms/v2/forms', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Forms API failed with status ${response.status}`)
      }

      const hubspotForms = await response.json()
      const transformedForms = hubspotForms.map((form: { guid: string; name: string }) => ({
        name: form.name,
        analytics: undefined, // No cached analytics in fallback
        guid: form.guid,
      }))

      return <BeforeDashboardClientCached forms={transformedForms} />
    } catch (_fallbackErr) {
      return <div>Failed to load HubSpot forms. Please check your API configuration.</div>
    }
  }
}
