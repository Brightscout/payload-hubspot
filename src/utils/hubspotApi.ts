import type { PayloadRequest } from 'payload'

import type { PayloadHubspotConfig } from '../index.js'

// Cache storage for HubSpot forms data
let formsCache: {
  data: unknown
  timestamp: number
} | null = null
const CACHE_DURATION = 3600 * 1000 // 1 hour in milliseconds

// Rate limiting configuration
const RATE_LIMIT_DELAY = 50 // 50ms between requests (max ~100 requests per minute)
const MAX_RETRIES = 3
const BASE_RETRY_DELAY = 1000 // 1 second base delay for retries

// Helper function to add delay between requests
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Helper function for exponential backoff
const exponentialBackoff = (attempt: number): number => {
  return BASE_RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 1000
}

// Logging helper - only logs when explicitly enabled
const debugLog = (message: string): void => {
  if (process.env.HUBSPOT_DEBUG === 'true') {
    // eslint-disable-next-line no-console
    console.log(`[HubSpot Plugin] ${message}`)
  }
}

const warnLog = (message: string): void => {
  // eslint-disable-next-line no-console
  console.warn(`[HubSpot Plugin] ${message}`)
}

const errorLog = (message: string, error?: unknown): void => {
  // eslint-disable-next-line no-console
  console.error(`[HubSpot Plugin] ${message}`, error)
}

export const getHubSpotHeaders = (pluginOptions: PayloadHubspotConfig) => ({
  Authorization: `Bearer ${pluginOptions.apiKey || process.env.HUBSPOT_API_KEY}`,
  'Content-Type': 'application/json',
})

// Rate-limited analytics fetching with exponential backoff
const fetchFormAnalyticsWithRetry = async (
  formGuid: string,
  pluginOptions: PayloadHubspotConfig,
  attempt: number = 0,
): Promise<{ totals?: Record<string, number> }> => {
  try {
    const analyticsResponse = await fetch(
      `https://api.hubapi.com/analytics/v2/reports/forms/total?f=${formGuid}`,
      { headers: getHubSpotHeaders(pluginOptions) },
    )

    // Handle rate limiting with exponential backoff
    if (analyticsResponse.status === 429) {
      if (attempt < MAX_RETRIES) {
        const backoffDelay = exponentialBackoff(attempt)
        warnLog(
          `Rate limit hit for form ${formGuid}. Retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        )
        await delay(backoffDelay)
        return fetchFormAnalyticsWithRetry(formGuid, pluginOptions, attempt + 1)
      } else {
        throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries`)
      }
    }

    if (!analyticsResponse.ok) {
      const errorText = await analyticsResponse.text()
      throw new Error(`Analytics API failed with status ${analyticsResponse.status}: ${errorText}`)
    }

    return await analyticsResponse.json()
  } catch (error) {
    if (attempt < MAX_RETRIES && error instanceof Error && error.message.includes('fetch')) {
      // Network error, retry with backoff
      const backoffDelay = exponentialBackoff(attempt)
      warnLog(
        `Network error for form ${formGuid}. Retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      )
      await delay(backoffDelay)
      return fetchFormAnalyticsWithRetry(formGuid, pluginOptions, attempt + 1)
    }
    throw error
  }
}

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

    // Process forms sequentially with rate limiting to prevent API overload
    const formsWithStats = []
    debugLog(`Processing ${forms.length} forms with rate limiting...`)

    for (let i = 0; i < forms.length; i++) {
      const form = forms[i]

      try {
        // Add delay between requests (except for the first one)
        if (i > 0) {
          await delay(RATE_LIMIT_DELAY)
        }

        debugLog(
          `Fetching analytics for form ${i + 1}/${forms.length}: ${form.name} (${form.guid})`,
        )

        // Get analytics with retry logic
        const analytics = await fetchFormAnalyticsWithRetry(form.guid, pluginOptions)

        // Extract meaningful stats from analytics
        const totals = analytics.totals || {}
        formsWithStats.push({
          ...form,
          stats: {
            clickThroughRate: totals.clickThroughPerFormView || 0,
            conversionRate:
              (totals.submissionsPerFormView || 0) > 1
                ? undefined
                : totals.submissionsPerFormView || 0,
            interactions: totals.interactions || 0,
            nonContactSubmissions: totals.nonContactSubmissions || 0,
            submissionRate: totals.submissionsPerClickThrough || 0,
            submissions: totals.submissions || 0,
            views: totals.formViews || 0,
          },
        })

        debugLog(`Successfully fetched analytics for form: ${form.name}`)
      } catch (err) {
        errorLog(
          `Error fetching stats for form ${form.guid}:`,
          err instanceof Error ? err.message : err,
        )

        // Add form with zero stats on error
        formsWithStats.push({
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
        })
      }
    }

    debugLog(`Completed processing all ${formsWithStats.length} forms`)
    // Update cache
    formsCache = {
      data: formsWithStats,
      timestamp: now,
    }
    return new Response(JSON.stringify(formsWithStats), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    errorLog('Error fetching HubSpot forms:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch HubSpot forms' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}
