export const getEnvironment = (): 'development' | 'staging' | 'production' => {
  const hostname = globalThis?.location?.hostname || ''
  
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'development'
  }
  
  if (hostname.includes('staging') || hostname.includes('preview')) {
    return 'staging'
  }
  
  return 'production'
}

export const getRetellApiKey = (): string => {
  // This function is only used in edge functions where Deno is available
  return ''
}

export const getRetellWebhookSecret = (): string => {
  // This function is only used in edge functions where Deno is available
  return ''
}

export const isProduction = (): boolean => getEnvironment() === 'production'
export const isDevelopment = (): boolean => getEnvironment() === 'development'
export const isStaging = (): boolean => getEnvironment() === 'staging'

// Legacy compatibility exports
export const getEnvironmentConfig = () => ({ 
  environment: getEnvironment(),
  isProduction: isProduction(),
  testLevel: isDevelopment() ? 'full' : 'minimal',
  testOrgId: 'test-org-id',
  isTestingEnabled: !isProduction()
})
export const shouldShowChannel = (channel: string, userRole: string, orgStatus: string) => true
export const shouldExcludeFromCustomerView = (item: any) => false