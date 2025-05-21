import type { Response } from 'node-fetch'
import type { Config } from 'payload'

import type { PayloadHubspotConfig } from '../src/index.js'

import { payloadHubspot } from '../src/index.js'

// Mock the payload module
jest.mock('payload', () => {
  return {
    buildConfig: jest.fn((config) => {
      return {
        ...config,
        // Add any missing required properties
      }
    }),
  }
})

// Create a properly typed mock for fetch
const mockFetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve([
        {
          name: 'Test Form',
          guid: 'test-form-id',
        },
      ]),
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
  } as Response),
)

// Replace global fetch with our mock
global.fetch = mockFetch

// Mock console methods
console.error = jest.fn()
console.warn = jest.fn()

describe('PayloadCMS HubSpot Plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve([
            {
              name: 'Test Form',
              guid: 'test-form-id',
            },
          ]),
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
      } as Response),
    )
  })

  describe('Plugin Configuration', () => {
    it('should add the hubspot-forms collection to payload config', () => {
      // Create a minimal valid config
      const config = {
        admin: {
          user: 'users',
        },
        collections: [],
        db: {
          connect: async () => {},
          defaultIDType: 'uuid',
          disconnect: async () => {},
          init: async () => {},
        },
        secret: 'test-secret',
      } as unknown as Config

      const pluginOptions: PayloadHubspotConfig = {
        apiKey: 'test-api-key',
      }

      const result = payloadHubspot(pluginOptions)(config)

      // Check if the hubspot-forms collection was added
      expect(result.collections).toBeDefined()
      expect(result.collections!).toHaveLength(1)
      expect(result.collections![0].slug).toBe('hubspot-forms')

      // Check fields with type safety
      const fields = result.collections![0].fields
      expect(fields).toHaveLength(2)

      // Use type assertion to access field properties safely
      const formIdField = fields[0] as any
      const nameField = fields[1] as any
      expect(formIdField.name).toBe('formId')
      expect(nameField.name).toBe('name')
    })

    it('should add HubSpot fields to specified collections', () => {
      const config = {
        admin: {
          user: 'users',
        },
        collections: [
          {
            slug: 'pages',
            fields: [],
          },
        ],
        db: {
          connect: async () => {},
          defaultIDType: 'uuid',
          disconnect: async () => {},
          init: async () => {},
        },
        secret: 'test-secret',
      } as unknown as Config

      const pluginOptions: PayloadHubspotConfig = {
        apiKey: 'test-api-key',
        collections: {
          pages: true,
        },
      }

      const result = payloadHubspot(pluginOptions)(config)

      // Check if the field was added to the pages collection
      expect(result.collections).toBeDefined()
      const pagesCollection = result.collections!.find((c) => c.slug === 'pages')
      expect(pagesCollection).toBeDefined()
      expect(pagesCollection?.fields).toHaveLength(1)

      // Use type assertion to access field properties safely
      const addedField = pagesCollection?.fields[0] as any
      expect(addedField.name).toBe('addedByPlugin')
    })

    it('should add endpoints to payload config', () => {
      const config = {
        admin: {
          user: 'users',
        },
        collections: [],
        db: {
          connect: async () => {},
          defaultIDType: 'uuid',
          disconnect: async () => {},
          init: async () => {},
        },
        secret: 'test-secret',
      } as unknown as Config

      const pluginOptions: PayloadHubspotConfig = {
        apiKey: 'test-api-key',
      }

      const result = payloadHubspot(pluginOptions)(config)

      // Check if the endpoints were added
      expect(result.endpoints).toBeDefined()
      expect(result.endpoints!).toHaveLength(2)
      expect(result.endpoints![0].path).toBe('/hubspot/forms')
      expect(result.endpoints![0].method).toBe('get')
      expect(result.endpoints![1].path).toBe('/my-plugin-endpoint')
      expect(result.endpoints![1].method).toBe('get')
    })

    it('should add beforeDashboard component to admin config', () => {
      const config = {
        admin: {
          user: 'users',
        },
        collections: [],
        db: {
          connect: async () => {},
          defaultIDType: 'uuid',
          disconnect: async () => {},
          init: async () => {},
        },
        secret: 'test-secret',
      } as unknown as Config

      const pluginOptions: PayloadHubspotConfig = {
        apiKey: 'test-api-key',
      }

      const result = payloadHubspot(pluginOptions)(config)

      // Check if the beforeDashboard component was added
      expect(result.admin).toBeDefined()
      expect(result.admin?.components).toBeDefined()
      expect(result.admin?.components?.beforeDashboard).toBeDefined()
      expect(result.admin?.components?.beforeDashboard).toHaveLength(1)
      expect(result.admin?.components?.beforeDashboard?.[0]).toBe(
        'payload-hubspot/rsc#BeforeDashboardServer',
      )
    })

    it('should not modify config when disabled is true', () => {
      const config = {
        admin: {
          user: 'users',
        },
        collections: [],
        db: {
          connect: async () => {},
          defaultIDType: 'uuid',
          disconnect: async () => {},
          init: async () => {},
        },
        secret: 'test-secret',
      } as unknown as Config

      const pluginOptions: PayloadHubspotConfig = {
        apiKey: 'test-api-key',
        disabled: true,
      }

      const result = payloadHubspot(pluginOptions)(config)

      // Collections should still be added for schema consistency
      expect(result.collections).toBeDefined()
      expect(result.collections!).toHaveLength(1)

      // But endpoints should not be added
      expect(result.endpoints).toBeUndefined()
    })
  })

  describe('HubSpot API Integration', () => {
    it('should fetch forms from HubSpot API on init', async () => {
      const config = {
        admin: {
          user: 'users',
        },
        collections: [],
        db: {
          connect: async () => {},
          defaultIDType: 'uuid',
          disconnect: async () => {},
          init: async () => {},
        },
        secret: 'test-secret',
      } as unknown as Config

      const pluginOptions: PayloadHubspotConfig = {
        apiKey: 'test-api-key',
      }

      const result = payloadHubspot(pluginOptions)(config)

      // Mock payload methods with proper typing
      const mockPayload = {
        find: jest.fn().mockResolvedValue({ docs: [{ id: '123', formId: 'test-form-id' }] }),
        update: jest.fn(),
      }

      // Call onInit
      expect(result.onInit).toBeDefined()
      await result.onInit?.(mockPayload as any)

      // Check if fetch was called with the correct URL and headers
      expect(global.fetch).toHaveBeenCalledWith('https://api.hubapi.com/forms/v2/forms', {
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
      })

      // Check if payload.update was called to update the form name
      expect(mockPayload.update).toHaveBeenCalledWith({
        id: '123',
        collection: 'hubspot-forms',
        data: {
          name: 'Test Form',
        },
      })
    })

    it('should handle API errors gracefully', async () => {
      const config = {
        admin: {
          user: 'users',
        },
        collections: [],
        db: {
          connect: async () => {},
          defaultIDType: 'uuid',
          disconnect: async () => {},
          init: async () => {},
        },
        secret: 'test-secret',
      } as unknown as Config

      const pluginOptions: PayloadHubspotConfig = {
        apiKey: 'test-api-key',
      }

      const result = payloadHubspot(pluginOptions)(config)

      // Mock fetch to throw an error
      mockFetch.mockImplementation(() => Promise.reject(new Error('API Error')))

      // Mock payload methods
      const mockPayload = {
        find: jest.fn(),
        update: jest.fn(),
      }

      // Call onInit
      expect(result.onInit).toBeDefined()
      await result.onInit?.(mockPayload as any)

      // Check if console.error was called
      expect(console.error).toHaveBeenCalledWith('Error syncing HubSpot forms:', expect.any(Error))
    })

    it('should warn if API key is missing', async () => {
      const config = {
        admin: {
          user: 'users',
        },
        collections: [],
        db: {
          connect: async () => {},
          defaultIDType: 'uuid',
          disconnect: async () => {},
          init: async () => {},
        },
        secret: 'test-secret',
      } as unknown as Config

      const pluginOptions: PayloadHubspotConfig = {}

      const result = payloadHubspot(pluginOptions)(config)

      // Mock payload methods
      const mockPayload = {
        find: jest.fn(),
        update: jest.fn(),
      }

      // Call onInit
      expect(result.onInit).toBeDefined()
      await result.onInit?.(mockPayload as any)

      // Check if console.warn was called
      expect(console.warn).toHaveBeenCalledWith('HubSpot API key not found. Forms sync skipped.')
    })
  })
})
