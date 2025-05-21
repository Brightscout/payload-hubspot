import type { PayloadRequest } from 'payload'

import type { PayloadHubspotConfig } from '../index.js'

// Cache storage for HubSpot forms data
let formsCache: {
  data: any
  timestamp: number
} | null = null
const CACHE_DURATION = 3600 * 1000 // 1 hour in milliseconds

export const getHubSpotHeaders = (pluginOptions: PayloadHubspotConfig) => ({
  Authorization: `Bearer ${pluginOptions.apiKey || process.env.HUBSPOT_API_KEY}`,
  'Content-Type': 'application/json',
})

export const hubspotFormsHandler = async (
  req: PayloadRequest,
  pluginOptions: PayloadHubspotConfig,
): Promise<Response> => {
  try {
    // Check for refresh parameter in the URL if available
    const url = req.url || ''
    const forceRefresh = url.includes('refresh=true')
    const now = Date.now()
    if (
      !forceRefresh &&
      formsCache &&
      formsCache.data &&
      now - formsCache.timestamp < CACHE_DURATION
    ) {
      return new Response(JSON.stringify(formsCache.data), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Fetch forms data
    const formsResponse = await fetch('https://api.hubapi.com/forms/v2/forms', {
      headers: getHubSpotHeaders(pluginOptions),
    })
    if (!formsResponse.ok) {
      const errorText = await formsResponse.text()
      throw new Error(`Forms API failed with status ${formsResponse.status}: ${errorText}`)
    }
    const forms = await formsResponse.json()
    // For each form, fetch additional stats
    const formsWithStats = await Promise.all(
      forms.map(async (form: any) => {
        try {
          // Get analytics
          const analyticsResponse = await fetch(
            `https://api.hubapi.com/analytics/v2/reports/forms/total?f=${form.guid}`,
            { headers: getHubSpotHeaders(pluginOptions) },
          )
          if (!analyticsResponse.ok) {
            const errorText = await analyticsResponse.text()
            throw new Error(
              `Analytics API failed with status ${analyticsResponse.status}: ${errorText}`,
            )
          }
          const analytics = await analyticsResponse.json()

          // Extract meaningful stats from analytics
          const totals = analytics.totals || {}
          return {
            ...form,
            stats: {
              clickThroughRate: totals.clickThroughPerFormView || 0,
              conversionRate: totals.submissionsPerFormView || 0,
              interactions: totals.interactions || 0,
              nonContactSubmissions: totals.nonContactSubmissions || 0,
              submissionRate: totals.submissionsPerClickThrough || 0,
              submissions: totals.submissions || 0,
              views: totals.formViews || 0,
            },
          }
        } catch (err) {
          console.error(
            `Error fetching stats for form ${form.guid}:`,
            err instanceof Error ? err.message : err,
          )
          return {
            ...form,
            stats: {
              clickThroughRate: 0,
              conversionRate: 0,
              interactions: 0,
              nonContactSubmissions: 0,
              submissionRate: 0,
              submissions: 0,
              views: 0,
            },
          }
        }
      }),
    )
    // Update cache
    formsCache = {
      data: formsWithStats,
      timestamp: now,
    }
    return new Response(JSON.stringify(formsWithStats), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching HubSpot forms:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch HubSpot forms' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}
