'use client'

import React, { useState } from 'react'
import { useConfig } from '@payloadcms/ui'
import styles from './BeforeDashboardClient.module.css'

type HubSpotForm = {
  guid: string
  name: string
  stats: {
    views: number
    submissions: number
    conversionRate: number
  }
}

type BeforeDashboardClientProps = {
  forms: HubSpotForm[]
}

export const BeforeDashboardClient = ({ forms: initialForms }: BeforeDashboardClientProps) => {
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [forms, setForms] = useState<HubSpotForm[]>(initialForms || [])

  if (!forms || !Array.isArray(forms)) {
    return <div>No HubSpot forms available</div>
  }

  const totalSubmissions = forms.reduce((sum, form) => sum + form.stats.submissions, 0)
  const totalViews = forms.reduce((sum, form) => sum + form.stats.views, 0)
  const averageConversionRate =
    forms.reduce((sum, form) => sum + form.stats.conversionRate, 0) / forms.length

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return (
      <div className={styles.hubspotDashboard}>
        <div className={styles.loadingSpinner} />
        Loading HubSpot dashboard...
      </div>
    )
  }

  return (
    <div className={styles.hubspotDashboard}>
      <div className={styles.hubspotDashboardHeader}>
        <h2>HubSpot Forms Overview</h2>
        <button
          className={styles.refreshButton}
          onClick={async () => {
            try {
              setLoading(true)
              const response = await fetch('/api/hubspot/forms?refresh=true')
              if (!response.ok) {
                throw new Error('Failed to refresh forms')
              }
              const newForms = await response.json()
              setForms(newForms)
            } catch (error) {
              console.error('Error refreshing forms:', error)
            } finally {
              setLoading(false)
            }
          }}
        >
          Refresh Data
        </button>
      </div>

      <div className={styles.hubspotDashboardStats}>
        <div className={styles.statCard}>
          <h3>Total Forms</h3>
          <p>{forms.length}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Total Views</h3>
          <p>{totalViews}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Total Submissions</h3>
          <p>{totalSubmissions}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Avg. Conversion Rate</h3>
          <p>{(averageConversionRate * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className={styles.hubspotDashboardRecent}>
        <h3>All Forms</h3>
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Form Name</th>
                <th>Form ID</th>
                <th>Views</th>
                <th>Submissions</th>
                <th>Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {forms
                .sort((a, b) => b.stats.views - a.stats.views)
                .map((form) => (
                  <tr key={form.guid}>
                    <td>{form.name}</td>
                    <td>
                      <div className={styles.copyContainer}>
                        {form.guid}
                        <button
                          className={styles.copyButton}
                          onClick={() => copyToClipboard(form.guid)}
                          title="Copy to clipboard"
                        >
                          {copiedId === form.guid ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                    <td>{form.stats.views}</td>
                    <td>{form.stats.submissions}</td>
                    <td>{(form.stats.conversionRate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
