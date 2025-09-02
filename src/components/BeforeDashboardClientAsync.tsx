'use client'

import React, { useEffect, useState } from 'react'

import styles from './BeforeDashboardClient.module.css'

type HubSpotFormStats = {
  clickThroughRate: number
  conversionRate?: number
  error?: boolean
  interactions: number
  loading?: boolean
  nonContactSubmissions: number
  submissionRate: number
  submissions: number
  views: number
}

type HubSpotForm = {
  guid: string
  name: string
  stats?: HubSpotFormStats
}

type BeforeDashboardClientAsyncProps = {
  forms: HubSpotForm[]
}

export const BeforeDashboardClientAsync = ({
  forms: initialForms,
}: BeforeDashboardClientAsyncProps) => {
  const [forms, setForms] = useState<HubSpotForm[]>(
    initialForms.map((form) => ({
      ...form,
      stats: {
        clickThroughRate: 0,
        conversionRate: 0,
        interactions: 0,
        loading: true,
        nonContactSubmissions: 0,
        submissionRate: 0,
        submissions: 0,
        views: 0,
      },
    })),
  )
  const [loadingCount, setLoadingCount] = useState(0)
  const [copiedId, setCopiedId] = useState<null | string>(null)
  const [globalLoading, setGlobalLoading] = useState(true)

  // Load analytics for each form individually with delays
  useEffect(() => {
    let isCancelled = false
    const timeouts: NodeJS.Timeout[] = []

    const loadFormAnalytics = async () => {
      const delay = (ms: number) =>
        new Promise<void>((resolve) => {
          const timeoutId = setTimeout(() => {
            if (!isCancelled) {
              resolve()
            }
          }, ms)
          timeouts.push(timeoutId)
        })

      for (let i = 0; i < initialForms.length; i++) {
        const form = initialForms[i]

        try {
          // Add delay between requests (2 seconds to respect rate limits)
          if (i > 0) {
            await delay(2000)
          }

          setLoadingCount(i + 1)

          const response = await fetch(`/api/hubspot/form-analytics/${form.guid}`)

          if (response.ok) {
            const data = await response.json()

            setForms((prevForms) =>
              prevForms.map((f) =>
                f.guid === form.guid
                  ? {
                      ...f,
                      stats: {
                        ...data.stats,
                        error: false,
                        loading: false,
                      },
                    }
                  : f,
              ),
            )
          } else {
            // Handle error - show form with error state
            // console.error(`Failed to load analytics for form ${form.guid}: ${response.status}`)

            setForms((prevForms) =>
              prevForms.map((f) =>
                f.guid === form.guid
                  ? {
                      ...f,
                      stats: {
                        clickThroughRate: 0,
                        conversionRate: 0,
                        error: true,
                        interactions: 0,
                        loading: false,
                        nonContactSubmissions: 0,
                        submissionRate: 0,
                        submissions: 0,
                        views: 0,
                      },
                    }
                  : f,
              ),
            )
          }
        } catch (_error) {
          // console.error(`Error loading analytics for form ${form.guid}:`, _error)

          setForms((prevForms) =>
            prevForms.map((f) =>
              f.guid === form.guid
                ? {
                    ...f,
                    stats: {
                      clickThroughRate: 0,
                      conversionRate: 0,
                      error: true,
                      interactions: 0,
                      loading: false,
                      nonContactSubmissions: 0,
                      submissionRate: 0,
                      submissions: 0,
                      views: 0,
                    },
                  }
                : f,
            ),
          )
        }
      }

      setGlobalLoading(false)
    }

    if (initialForms.length > 0) {
      void loadFormAnalytics()
    } else {
      setGlobalLoading(false)
    }

    return () => {
      isCancelled = true
      timeouts.forEach(clearTimeout)
    }
  }, [initialForms])

  // Cleanup timeout for copied ID
  useEffect(() => {
    if (copiedId) {
      const timeoutId = setTimeout(() => setCopiedId(null), 2000)
      return () => clearTimeout(timeoutId)
    }
  }, [copiedId])

  const refreshAllData = () => {
    setGlobalLoading(true)
    setLoadingCount(0)

    // Reset all forms to loading state
    setForms((prevForms) =>
      prevForms.map((form) => ({
        ...form,
        stats: {
          clickThroughRate: 0,
          conversionRate: 0,
          interactions: 0,
          loading: true,
          nonContactSubmissions: 0,
          submissionRate: 0,
          submissions: 0,
          views: 0,
        },
      })),
    )

    // Trigger reload by updating a state that useEffect depends on
    window.location.reload()
  }

  if (!forms || !Array.isArray(forms)) {
    return <div>No HubSpot forms available</div>
  }

  // Calculate totals from loaded forms only
  const loadedForms = forms.filter((form) => form.stats && !form.stats.loading && !form.stats.error)
  const totalSubmissions = loadedForms.reduce(
    (sum, form) => sum + (form.stats?.submissions || 0),
    0,
  )
  const totalViews = loadedForms.reduce((sum, form) => sum + (form.stats?.views || 0), 0)
  const validConversionRates = loadedForms.filter(
    (form) => form.stats?.conversionRate !== undefined,
  )
  const averageConversionRate =
    validConversionRates.length > 0
      ? validConversionRates.reduce((sum, form) => sum + (form.stats?.conversionRate || 0), 0) /
        validConversionRates.length
      : undefined

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedId(text)
  }

  return (
    <div className="gutter--left gutter--right collection-list__wrap">
      <div className={styles.hubspotDashboardHeader}>
        <h1>HubSpot Forms Overview</h1>
        <div className={styles.headerControls}>
          {globalLoading && (
            <span className={styles.loadingText}>
              Loading analytics... ({loadingCount}/{forms.length})
            </span>
          )}
          <button
            className={styles.refreshButton}
            disabled={globalLoading}
            onClick={refreshAllData}
            type="button"
          >
            {globalLoading ? 'Loading...' : 'Refresh Data'}
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
          <p>{globalLoading ? '...' : totalViews.toLocaleString()}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Total Submissions</h3>
          <p>{globalLoading ? '...' : totalSubmissions.toLocaleString()}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Avg. Conversion Rate</h3>
          <p>
            {globalLoading
              ? '...'
              : averageConversionRate
                ? `${(averageConversionRate * 100).toFixed(1)}%`
                : 'N/A'}
          </p>
        </div>
      </div>

      <div className={styles.hubspotDashboardRecent}>
        <h3>All Available Forms</h3>
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Form Name</th>
                <th>Form ID</th>
                <th>Views</th>
                <th>Submissions</th>
                <th>Conversion Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {forms
                .sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0))
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
                      {form.stats?.loading ? (
                        <div className={styles.loadingSpinner} />
                      ) : form.stats?.error ? (
                        <span className={styles.errorText}>Error</span>
                      ) : (
                        (form.stats?.views || 0).toLocaleString()
                      )}
                    </td>
                    <td>
                      {form.stats?.loading ? (
                        <div className={styles.loadingSpinner} />
                      ) : form.stats?.error ? (
                        <span className={styles.errorText}>Error</span>
                      ) : (
                        (form.stats?.submissions || 0).toLocaleString()
                      )}
                    </td>
                    <td>
                      {form.stats?.loading ? (
                        <div className={styles.loadingSpinner} />
                      ) : form.stats?.error ? (
                        <span className={styles.errorText}>Error</span>
                      ) : form.stats?.conversionRate === undefined ? (
                        'N/A'
                      ) : (
                        `${(form.stats.conversionRate * 100).toFixed(1)}%`
                      )}
                    </td>
                    <td>
                      {form.stats?.loading ? (
                        <span className={styles.statusLoading}>Loading...</span>
                      ) : form.stats?.error ? (
                        <span className={styles.statusError}>Failed</span>
                      ) : (
                        <span className={styles.statusSuccess}>Loaded</span>
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
