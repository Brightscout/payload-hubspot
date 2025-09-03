'use client'

import React, { useEffect, useState } from 'react'

import styles from './BeforeDashboardClient.module.css'

type HubSpotFormAnalytics = {
  clickThroughRate: number
  conversionRate?: number
  interactions: number
  lastUpdated?: string
  nonContactSubmissions: number
  submissionRate: number
  submissions: number
  views: number
}

type HubSpotForm = {
  analytics?: HubSpotFormAnalytics
  guid: string
  isTracked?: boolean
  name: string
  refreshing?: boolean
}

type BeforeDashboardClientCachedProps = {
  forms: HubSpotForm[]
}

export const BeforeDashboardClientCached = ({
  forms: initialForms,
}: BeforeDashboardClientCachedProps) => {
  const [forms, setForms] = useState<HubSpotForm[]>(initialForms)
  const [copiedId, setCopiedId] = useState<null | string>(null)
  const [globalRefreshing, setGlobalRefreshing] = useState(false)

  // Cleanup timeout for copied ID
  useEffect(() => {
    if (copiedId) {
      const timeoutId = setTimeout(() => setCopiedId(null), 2000)
      return () => clearTimeout(timeoutId)
    }
  }, [copiedId])

  if (!forms || !Array.isArray(forms)) {
    return <div>No HubSpot forms available</div>
  }

  // Calculate totals from all forms with analytics
  const formsWithAnalytics = forms.filter((form) => form.analytics)
  const totalSubmissions = formsWithAnalytics.reduce(
    (sum, form) => sum + (form.analytics?.submissions || 0),
    0,
  )
  const totalViews = formsWithAnalytics.reduce((sum, form) => sum + (form.analytics?.views || 0), 0)
  const validConversionRates = formsWithAnalytics.filter(
    (form) => form.analytics?.conversionRate !== undefined,
  )
  const averageConversionRate =
    validConversionRates.length > 0
      ? validConversionRates.reduce((sum, form) => sum + (form.analytics?.conversionRate || 0), 0) /
        validConversionRates.length
      : undefined

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedId(text)
  }

  const refreshAllAnalytics = async () => {
    setGlobalRefreshing(true)
    try {
      const response = await fetch('/api/hubspot/refresh-analytics', {
        method: 'POST',
      })

      if (response.ok) {
        // Reload the page to get fresh data
        window.location.reload()
      } else {
        // Failed to refresh analytics - silently handled
      }
    } catch (_error) {
      // Error refreshing analytics - silently handled
    } finally {
      setGlobalRefreshing(false)
    }
  }

  const refreshFormAnalytics = async (formId: string) => {
    setForms((prevForms) =>
      prevForms.map((form) => (form.guid === formId ? { ...form, refreshing: true } : form)),
    )

    try {
      const response = await fetch(`/api/hubspot/refresh-analytics/${formId}`, {
        method: 'POST',
      })

      if (response.ok) {
        // Reload the page to get fresh data
        window.location.reload()
      } else {
        // Failed to refresh analytics for form - silently handled
      }
    } catch (_error) {
      // Error refreshing analytics for form - silently handled
    } finally {
      setForms((prevForms) =>
        prevForms.map((form) => (form.guid === formId ? { ...form, refreshing: false } : form)),
      )
    }
  }

  const getAnalyticsAge = (lastUpdated?: string): string => {
    if (!lastUpdated) {
      return 'Never updated'
    }

    const now = new Date()
    const updated = new Date(lastUpdated)
    const diffMs = now.getTime() - updated.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ago`
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`
    } else {
      return 'Just now'
    }
  }

  const isAnalyticsStale = (lastUpdated?: string): boolean => {
    if (!lastUpdated) {
      return true
    }

    const now = new Date()
    const updated = new Date(lastUpdated)
    const diffMs = now.getTime() - updated.getTime()
    const staleThreshold = 24 * 60 * 60 * 1000 // 24 hours

    return diffMs > staleThreshold
  }

  return (
    <div className="gutter--left gutter--right collection-list__wrap">
      <div className={styles.hubspotDashboardHeader}>
        <h1>HubSpot Forms Overview</h1>
        <div className={styles.headerControls}>
          <button
            className={styles.refreshButton}
            disabled={globalRefreshing}
            onClick={refreshAllAnalytics}
            type="button"
          >
            {globalRefreshing ? 'Refreshing...' : 'Refresh All Analytics'}
          </button>
        </div>
      </div>

      <div className={styles.hubspotDashboardStats}>
        <div className={styles.statCard}>
          <h3>Total Forms</h3>
          <p>{forms.length}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Total Views</h3>
          <p>{totalViews.toLocaleString()}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Total Submissions</h3>
          <p>{totalSubmissions.toLocaleString()}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Avg. Conversion Rate</h3>
          <p>{averageConversionRate ? `${(averageConversionRate * 100).toFixed(1)}%` : 'N/A'}</p>
        </div>
      </div>

      <div className={styles.hubspotDashboardRecent}>
        <h3>All Available Forms from HubSpot</h3>
        <p
          style={{
            color: 'var(--theme-elevation-600)',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}
        >
          Showing all forms from your HubSpot account. Only "Tracked" forms have cached analytics
          data.
        </p>
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Form Name</th>
                <th>Form ID</th>
                <th>Tracking Status</th>
                <th>Views</th>
                <th>Submissions</th>
                <th>Conversion Rate</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms
                .sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0))
                .map((form) => (
                  <tr key={form.guid}>
                    <td>{form.name}</td>
                    <td>
                      <div className={styles.copyContainer}>
                        <span className={styles.formId}>{form.guid}</span>
                        <button
                          aria-label={`Copy form ID ${form.guid} to clipboard`}
                          className={styles.copyButton}
                          onClick={() => copyToClipboard(form.guid)}
                          title="Copy to clipboard"
                          type="button"
                        >
                          {copiedId === form.guid ? (
                            <svg
                              fill="none"
                              height="16"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              width="16"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <svg
                              fill="none"
                              height="16"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              width="16"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <rect height="13" rx="2" ry="2" width="13" x="9" y="9"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span
                        className={form.isTracked ? styles.trackedBadge : styles.notTrackedBadge}
                      >
                        {form.isTracked ? 'Tracked' : 'Not Tracked'}
                      </span>
                    </td>
                    <td>
                      {form.analytics ? (
                        form.analytics.views.toLocaleString()
                      ) : (
                        <span className={styles.noData}>No data</span>
                      )}
                    </td>
                    <td>
                      {form.analytics ? (
                        form.analytics.submissions.toLocaleString()
                      ) : (
                        <span className={styles.noData}>No data</span>
                      )}
                    </td>
                    <td>
                      {form.analytics?.conversionRate !== undefined ? (
                        `${(form.analytics.conversionRate * 100).toFixed(1)}%`
                      ) : (
                        <span className={styles.noData}>N/A</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          isAnalyticsStale(form.analytics?.lastUpdated)
                            ? styles.staleData
                            : styles.freshData
                        }
                      >
                        {getAnalyticsAge(form.analytics?.lastUpdated)}
                      </span>
                    </td>
                    <td>
                      {form.isTracked ? (
                        <button
                          className={styles.refreshFormButton}
                          disabled={form.refreshing || globalRefreshing}
                          onClick={() => refreshFormAnalytics(form.guid)}
                          title="Refresh analytics for this form"
                          type="button"
                        >
                          {form.refreshing ? (
                            <div className={styles.loadingSpinner} />
                          ) : (
                            <svg
                              fill="none"
                              height="14"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              width="14"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                              <path d="M21 3v5h-5"></path>
                              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                              <path d="M3 21v-5h5"></path>
                            </svg>
                          )}
                        </button>
                      ) : (
                        <span className={styles.noData}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
