import type { Payload } from 'payload'

import type { PayloadHubspotConfig } from '../index.js'

import { getHubSpotHeaders } from './hubspotApi.js'

// Cache duration for analytics (24 hours)
const ANALYTICS_CACHE_DURATION = 24 * 60 * 60 * 1000

// Rate limiting configuration for analytics sync
const ANALYTICS_RATE_LIMIT_DELAY = 3000 // 3 seconds between requests
const MAX_FORMS_PER_SYNC = 20 // Limit forms processed per sync to avoid timeouts

// Helper function to add delay between requests
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Logging helper
const debugLog = (message: string): void => {
  if (process.env.HUBSPOT_DEBUG === 'true') {
    // eslint-disable-next-line no-console
    console.log(`[HubSpot Analytics Sync] ${message}`)
  }
}

const errorLog = (message: string, error?: unknown): void => {
  // eslint-disable-next-line no-console
  console.error(`[HubSpot Analytics Sync] ${message}`, error)
}

// Fetch form analytics with retry logic
const fetchFormAnalytics = async (
  formGuid: string,
  pluginOptions: PayloadHubspotConfig,
  attempt: number = 0,
): Promise<{ totals?: Record<string, number> }> => {
  const MAX_RETRIES = 3
  const BASE_RETRY_DELAY = 2000

  try {
    const analyticsResponse = await fetch(
      `https://api.hubapi.com/analytics/v2/reports/forms/total?f=${formGuid}`,
      { headers: getHubSpotHeaders(pluginOptions) },
    )

    // Handle rate limiting with exponential backoff
    if (analyticsResponse.status === 429) {
      if (attempt < MAX_RETRIES) {
        const backoffDelay = BASE_RETRY_DELAY * Math.pow(2, attempt)
        debugLog(`Rate limit hit for form ${formGuid}. Retrying in ${backoffDelay}ms`)
        await delay(backoffDelay)
        return fetchFormAnalytics(formGuid, pluginOptions, attempt + 1)
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
      const backoffDelay = BASE_RETRY_DELAY * Math.pow(2, attempt)
      debugLog(`Network error for form ${formGuid}. Retrying in ${backoffDelay}ms`)
      await delay(backoffDelay)
      return fetchFormAnalytics(formGuid, pluginOptions, attempt + 1)
    }
    throw error
  }
}

export const syncFormAnalytics = async (
  payload: Payload,
  pluginOptions: PayloadHubspotConfig,
  forceRefresh = false,
): Promise<void> => {
  try {
    debugLog('Starting analytics sync for manually added forms...')

    // Get all manually added forms from database
    const { docs: forms } = await payload.find({
      collection: 'hubspot-forms',
      limit: 1000,
      sort: 'name',
    })

    if (forms.length === 0) {
      debugLog('No forms found in database')
      return
    }

    // Filter forms that need analytics update
    const now = new Date()
    const formsToUpdate = forms.filter((form) => {
      if (forceRefresh) {
        return true
      }

      const lastUpdated = form.analytics?.lastUpdated
      if (!lastUpdated) {
        return true
      }

      const timeSinceUpdate = now.getTime() - new Date(lastUpdated).getTime()
      return timeSinceUpdate > ANALYTICS_CACHE_DURATION
    })

    if (formsToUpdate.length === 0) {
      debugLog('All forms have fresh analytics data')
      return
    }

    // Limit the number of forms to process to avoid timeouts
    const formsToProcess = formsToUpdate.slice(0, MAX_FORMS_PER_SYNC)

    debugLog(
      `Processing analytics for ${formsToProcess.length} forms (${formsToUpdate.length - formsToProcess.length} remaining)`,
    )

    // Process forms with rate limiting
    for (let i = 0; i < formsToProcess.length; i++) {
      const form = formsToProcess[i]

      try {
        // Add delay between requests (except for the first one)
        if (i > 0) {
          await delay(ANALYTICS_RATE_LIMIT_DELAY)
        }

        debugLog(
          `Fetching analytics for form ${i + 1}/${formsToProcess.length}: ${form.name} (${form.formId})`,
        )

        // Get analytics from HubSpot
        const analytics = await fetchFormAnalytics(form.formId, pluginOptions)

        // Extract meaningful stats from analytics
        const totals = analytics.totals || {}
        const analyticsData = {
          clickThroughRate: totals.clickThroughPerFormView || 0,
          conversionRate:
            (totals.submissionsPerFormView || 0) > 1
              ? undefined
              : totals.submissionsPerFormView || 0,
          interactions: totals.interactions || 0,
          lastUpdated: now.toISOString(),
          nonContactSubmissions: totals.nonContactSubmissions || 0,
          submissionRate: totals.submissionsPerClickThrough || 0,
          submissions: totals.submissions || 0,
          views: totals.formViews || 0,
        }

        // Update form in database with analytics
        await payload.update({
          id: form.id,
          collection: 'hubspot-forms',
          data: {
            analytics: analyticsData,
          },
        })

        debugLog(`Successfully updated analytics for form: ${form.name}`)
      } catch (error) {
        errorLog(`Error fetching analytics for form ${form.formId}:`, error)

        // Update with error state but keep existing data if available
        await payload.update({
          id: form.id,
          collection: 'hubspot-forms',
          data: {
            analytics: {
              ...form.analytics,
              lastUpdated: now.toISOString(),
            },
          },
        })
      }
    }

    debugLog(`Completed analytics sync for ${formsToProcess.length} forms`)
  } catch (error) {
    errorLog('Error during analytics sync:', error)
  }
}

export const refreshFormAnalytics = async (
  payload: Payload,
  pluginOptions: PayloadHubspotConfig,
  formId?: string,
): Promise<void> => {
  try {
    if (formId) {
      // Refresh specific form
      const { docs } = await payload.find({
        collection: 'hubspot-forms',
        where: {
          formId: {
            equals: formId,
          },
        },
      })

      if (docs.length === 0) {
        throw new Error(`Form with ID ${formId} not found`)
      }

      const form = docs[0]
      debugLog(`Refreshing analytics for specific form: ${form.name}`)

      const analytics = await fetchFormAnalytics(formId, pluginOptions)
      const totals = analytics.totals || {}

      const analyticsData = {
        clickThroughRate: totals.clickThroughPerFormView || 0,
        conversionRate:
          (totals.submissionsPerFormView || 0) > 1 ? undefined : totals.submissionsPerFormView || 0,
        interactions: totals.interactions || 0,
        lastUpdated: new Date().toISOString(),
        nonContactSubmissions: totals.nonContactSubmissions || 0,
        submissionRate: totals.submissionsPerClickThrough || 0,
        submissions: totals.submissions || 0,
        views: totals.formViews || 0,
      }

      await payload.update({
        id: form.id,
        collection: 'hubspot-forms',
        data: {
          analytics: analyticsData,
        },
      })

      debugLog(`Successfully refreshed analytics for form: ${form.name}`)
    } else {
      // Refresh all forms
      await syncFormAnalytics(payload, pluginOptions, true)
    }
  } catch (error) {
    errorLog('Error refreshing form analytics:', error)
    throw error
  }
}
