// Re-export everything from ssot.ts to become the canonical import path
export * from './ssot'

// Compatibility re-exports for gradual migration
export { useEntitlements as useOrgEntitlements } from './ssot'
export { computeEntitlements as getOrgEntitlements } from './ssot'