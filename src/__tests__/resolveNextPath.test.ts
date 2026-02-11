import { describe, it, expect } from 'vitest';
import { resolveNextPath } from '@/lib/navigation/resolveNextPath';

describe('resolveNextPath', () => {
  it('allows safe relative paths', () => {
    expect(resolveNextPath('/agents')).toBe('/agents');
    expect(resolveNextPath('/dashboard')).toBe('/dashboard');
    expect(resolveNextPath('/settings/organization')).toBe('/settings/organization');
  });

  it('handles URL encoded safe paths', () => {
    expect(resolveNextPath('%2Fagents')).toBe('/agents');
    expect(resolveNextPath('%2Fdashboard')).toBe('/dashboard');
  });

  it('rejects protocol-relative URLs', () => {
    expect(resolveNextPath('//evil.com')).toBe('/dashboard');
    expect(resolveNextPath('//example.org/malicious')).toBe('/dashboard');
  });

  it('rejects absolute URLs', () => {
    expect(resolveNextPath('https://evil.com')).toBe('/dashboard');
    expect(resolveNextPath('http://malicious.org')).toBe('/dashboard');
  });

  it('rejects dangerous protocols', () => {
    expect(resolveNextPath('javascript:alert(1)')).toBe('/dashboard');
    expect(resolveNextPath('JavaScript:alert(document.domain)')).toBe('/dashboard');
    expect(resolveNextPath('data:text/html,<script>alert(1)</script>')).toBe('/dashboard');
    expect(resolveNextPath('vbscript:msgbox(1)')).toBe('/dashboard');
  });

  it('handles backslash paths by normalizing', () => {
    expect(resolveNextPath('\\agents')).toBe('/dashboard'); // Backslash fails validation, fallback
    expect(resolveNextPath('agents')).toBe('/agents'); // Gets normalized to /agents
  });

  it('rejects mixed encodings for external URLs', () => {
    expect(resolveNextPath('%2F%2Fevil.com')).toBe('/dashboard'); // //evil.com
    expect(resolveNextPath('%2F%2Fmalicious.org%2Fpath')).toBe('/dashboard');
  });

  it('handles invalid encoding gracefully', () => {
    expect(resolveNextPath('%ZZ')).toBe('/dashboard');
    expect(resolveNextPath('%')).toBe('/dashboard');
  });

  it('uses custom fallback when provided', () => {
    expect(resolveNextPath('//evil.com', '/custom')).toBe('/custom');
    expect(resolveNextPath(null, '/fallback')).toBe('/fallback');
  });

  it('handles null/empty input', () => {
    expect(resolveNextPath(null)).toBe('/dashboard');
    expect(resolveNextPath('')).toBe('/dashboard');
  });

  it('allows query parameters and fragments', () => {
    expect(resolveNextPath('/dashboard?tab=agents')).toBe('/dashboard?tab=agents');
    expect(resolveNextPath('/settings#billing')).toBe('/settings#billing');
  });

  it('rejects paths with invalid characters', () => {
    expect(resolveNextPath('/agents<script>')).toBe('/dashboard');
    expect(resolveNextPath('/path with spaces')).toBe('/dashboard');
  });
});