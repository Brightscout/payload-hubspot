import type { PayloadRequest } from 'payload'

import { getPluginOptions } from '../index.js'
import { hubspotFormsHandler } from '../utils/hubspotApi.js'
import { BeforeDashboardClient } from './BeforeDashboardClient.js'

export const BeforeDashboardServer = async () => {
  const pluginOptions = getPluginOptions()

  if (!pluginOptions) {
    console.error('Plugin options not available')
    return <div>HubSpot integration not properly configured</div>
  }

  try {
    const response = await hubspotFormsHandler({ query: {} } as PayloadRequest, pluginOptions)
    const forms = await response.json()
    return <BeforeDashboardClient forms={forms} />
  } catch (err) {
    console.error('Error fetching HubSpot forms:', err)
    return <div>Failed to load HubSpot forms</div>
  }
}
