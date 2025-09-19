import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import handler from '../../api/healthz';

// Mock the build-info module
vi.mock('../../lib/build-info', () => ({
  COMMIT_SHA: 'test-commit-123',
  BUILD_ID: 'test-build-456',
  BUILD_TIMESTAMP: '2024-01-15T10:30:00.000Z'
}));

describe('/api/healthz endpoint', () => {
  let req: Partial<IncomingMessage>;
  let res: Partial<ServerResponse>;
  let mockHeaders: Record<string, string>;
  let responseData: string;

  beforeEach(() => {
    mockHeaders = {};
    responseData = '';
    
    req = {
      method: 'GET',
      url: '/api/healthz'
    };

    res = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200
    } as any;
  });

  it('should return health status with version info', async () => {
    const mockSetHeader = vi.fn((name: string, value: string) => {
      mockHeaders[name] = value;
    });
    const mockEnd = vi.fn((data: string) => {
      responseData = data;
    });
    
    res.setHeader = mockSetHeader as any;
    res.end = mockEnd as any;
    
    handler(req as IncomingMessage, res as ServerResponse);

    // Check headers
    expect(mockSetHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(mockSetHeader).toHaveBeenCalledWith('Surrogate-Control', 'no-store');
    expect(mockSetHeader).toHaveBeenCalledWith('Content-Type', 'application/json');

    // Check response
    expect(res.statusCode).toBe(200);
    expect(mockEnd).toHaveBeenCalled();
    
    const response = JSON.parse(mockEnd.mock.calls[0][0]);
    expect(response.status).toBe('ok');
    expect(response.commit).toBe('test-commit-123');
    expect(response.buildId).toBe('test-build-456');
    expect(response.buildTimestamp).toBe('2024-01-15T10:30:00.000Z');
    expect(typeof response.uptimeSec).toBe('number');
    expect(response.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it('should set proper cache control headers', async () => {
    const mockSetHeader = vi.fn();
    res.setHeader = mockSetHeader as any;
    res.end = vi.fn() as any;
    
    handler(req as IncomingMessage, res as ServerResponse);

    expect(mockSetHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(mockSetHeader).toHaveBeenCalledWith('Surrogate-Control', 'no-store');
    expect(mockSetHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(mockSetHeader).toHaveBeenCalledWith('Expires', '0');
  });
});