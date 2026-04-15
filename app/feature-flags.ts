import featureFlagCatalogJson from './feature-flags.json'

type FeatureFlagCatalog = typeof featureFlagCatalogJson

export type FeatureFlagName = keyof FeatureFlagCatalog
export type FeatureFlagDefinition = FeatureFlagCatalog[FeatureFlagName]
type FeatureFlags = Record<FeatureFlagName, boolean>

export const featureFlagCatalog = featureFlagCatalogJson as FeatureFlagCatalog
export const featureFlagNames = Object.keys(
  featureFlagCatalog,
) as FeatureFlagName[]

const STORAGE_KEY = 'spill:feature-flags'

const envDefaults: FeatureFlags = {
  agentationDevtools:
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_AGENTATION === 'true',
}

const readOverrides = (): Partial<FeatureFlags> => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<FeatureFlags>) : {}
  } catch {
    return {}
  }
}

const readQueryOverrides = (): Partial<FeatureFlags> => {
  if (typeof window === 'undefined') {
    return {}
  }

  const search = new URLSearchParams(window.location.search)
  const enabled = search.getAll('ff')
  const disabled = search.getAll('ff-off')

  return {
    ...(enabled.includes('agentationDevtools')
      ? { agentationDevtools: true }
      : {}),
    ...(disabled.includes('agentationDevtools')
      ? { agentationDevtools: false }
      : {}),
  }
}

export const isFeatureEnabled = (name: FeatureFlagName): boolean => {
  const queryOverrides = readQueryOverrides()
  if (name in queryOverrides) {
    return queryOverrides[name] ?? envDefaults[name]
  }

  const overrides = readOverrides()
  return overrides[name] ?? envDefaults[name]
}

export const listFeatureFlags = (): FeatureFlags => ({
  agentationDevtools: isFeatureEnabled('agentationDevtools'),
})
