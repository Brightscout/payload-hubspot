import type { Payload } from 'payload'

import { getPayload } from 'payload'

import { getPluginOptions } from '../index.js'
import { BeforeDashboardClientAsync } from './BeforeDashboardClientAsync.js'

export const BeforeDashboardServer = async () => {
  const pluginOptions = getPluginOptions()

  if (!pluginOptions) {
    console.error('Plugin options not available')
    return <div>HubSpot integration not properly configured</div>
  }

  try {
    // Get forms from database (basic data only, no analytics)
    const payload = await getPayload({ config: {} as any })

    const { docs: forms } = await payload.find({
      collection: 'hubspot-forms',
      limit: 1000, // Adjust as needed
      sort: 'name',
    })

    // Transform to expected format
    const transformedForms = forms.map((form) => ({
      name: form.name,
      guid: form.formId,
    }))

    return <BeforeDashboardClientAsync forms={transformedForms} />
  } catch (err) {
    console.error('Error fetching HubSpot forms from database:', err)

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
      const transformedForms = hubspotForms.map((form: any) => ({
        name: form.name,
        guid: form.guid,
      }))

      return <BeforeDashboardClientAsync forms={transformedForms} />
    } catch (fallbackErr) {
      console.error('Error fetching HubSpot forms from API:', fallbackErr)
      return <div>Failed to load HubSpot forms. Please check your API configuration.</div>
    }
  }
}
