/**
 * Safely resolves a ?next= path parameter, ensuring it's a relative in-app path
 * Rejects absolute URLs, external domains, and javascript: schemes
 */
export function resolveNextPath(nextParam: string | null, fallback: string = '/dashboard'): string {
  if (!nextParam) {
    return fallback;
  }

  // Decode the URL parameter
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(nextParam);
  } catch {
    // Invalid encoding, use fallback
    return fallback;
  }

  // Reject absolute URLs (http:, https:, //, etc.)
  if (decodedPath.includes('://') || decodedPath.startsWith('//')) {
    return fallback;
  }

  // Reject javascript: and other dangerous schemes
  if (decodedPath.toLowerCase().startsWith('javascript:') || 
      decodedPath.toLowerCase().startsWith('data:') ||
      decodedPath.toLowerCase().startsWith('vbscript:')) {
    return fallback;
  }

  // Ensure path starts with /
  if (!decodedPath.startsWith('/')) {
    decodedPath = '/' + decodedPath;
  }

  // Basic validation - path should look like a route
  if (!/^\/[a-zA-Z0-9/_-]*(\?[^#]*)?(\#.*)?$/.test(decodedPath)) {
    return fallback;
  }

  return decodedPath;
}