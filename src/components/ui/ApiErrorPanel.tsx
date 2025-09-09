import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, X } from "lucide-react"

interface ValidationError {
  field?: string
  message: string
  suggestion?: string
}

interface ApiErrorPanelProps {
  error: any
  onDismiss?: () => void
}

// Helper function to parse validation errors into user-friendly messages
const parseValidationErrors = (details: any): string => {
  const messages: string[] = [];
  
  // Ensure details is an array of strings
  const detailsArray = Array.isArray(details) 
    ? details.map(d => typeof d === 'string' ? d : JSON.stringify(d))
    : typeof details === 'string' 
    ? [details]
    : [JSON.stringify(details)];
  
  for (const detail of detailsArray) {
    if (detail.includes('Unknown fields:')) {
      const fields = detail.replace('Unknown fields: ', '');
      messages.push(`Remove unknown fields: ${fields}`);
    } else if (detail.includes('inquiry_type is required')) {
      messages.push('inquiry_type must be contact or enterprise');
    } else if (detail.includes('inquiry_type') && detail.includes('must be either')) {
      messages.push('inquiry_type must be contact or enterprise');
    } else if (detail.includes('full_name is required')) {
      messages.push('full_name is required');
    } else if (detail.includes('email is required')) {
      messages.push('email is required');  
    } else if (detail.includes('message is required')) {
      messages.push('message is required');
    } else {
      // Fallback for other validation errors
      messages.push(detail);
    }
  }
  
  return messages.join('. ');
};

export function ApiErrorPanel({ error, onDismiss }: ApiErrorPanelProps) {
  // Parse 422 validation errors with safety checks
  const parse422Errors = (details: any): ValidationError[] => {
    const errors: ValidationError[] = []
    
    // Ensure details is an array of strings
    const detailsArray = Array.isArray(details) 
      ? details.map(d => typeof d === 'string' ? d : JSON.stringify(d))
      : typeof details === 'string' 
      ? [details]
      : [JSON.stringify(details)];
    
    for (const detail of detailsArray) {
      if (detail.includes('Unknown fields:')) {
        const fields = detail.replace('Unknown fields: ', '').split(', ')
        for (const field of fields) {
          if (field.includes('source metadata')) {
            errors.push({
              field: 'source metadata',
              message: `Remove: "${field}"`,
              suggestion: 'use: source_metadata'
            })
          } else {
            errors.push({
              field,
              message: `Remove: "${field}"`,
              suggestion: 'Field not allowed'
            })
          }
        }
      } else if (detail.includes('inquiry_type')) {
        if (detail.includes('is required')) {
          errors.push({
            field: 'inquiry_type',
            message: 'inquiry_type is required',
            suggestion: 'must be "contact" or "enterprise"'
          })
        } else if (detail.includes('must be either')) {
          errors.push({
            field: 'inquiry_type',
            message: 'Invalid inquiry_type value',
            suggestion: 'must be "contact" or "enterprise"'
          })
        }
      } else if (detail.includes('full_name is required')) {
        errors.push({
          field: 'full_name',
          message: 'full_name is required',
          suggestion: 'Must provide a name'
        })
      } else if (detail.includes('email is required')) {
        errors.push({
          field: 'email',
          message: 'email is required',
          suggestion: 'Must provide a valid email'
        })
      } else if (detail.includes('message is required')) {
        errors.push({
          field: 'message',
          message: 'message is required',
          suggestion: 'Must provide a message'
        })
      } else {
        errors.push({
          message: detail,
          suggestion: 'Check field format and requirements'
        })
      }
    }
    
    return errors
  }

  // Parse CRM errors (non-2xx) with safety checks
  const parseCrmError = (error: any): { endpoint?: string, status?: number, message: string } => {
    const errorStr = typeof error?.message === 'string' ? error.message : JSON.stringify(error || {})
    
    // Extract HTTP status
    const statusMatch = errorStr.match(/HTTP (\d+)/) || errorStr.match(/Status (\d+)/)
    const status = statusMatch ? parseInt(statusMatch[1]) : undefined
    
    // Extract endpoint info
    const endpointMatch = errorStr.match(/\(([^)]+)\)/)
    const endpoint = endpointMatch ? endpointMatch[1] : undefined
    
    return {
      endpoint,
      status,
      message: errorStr
    }
  }

  // Determine error type with safety checks
  const is422Error = error?.status === 422 || error?.message?.includes?.('Status 422') || error?.message?.includes?.('HTTP 422')
  const validationDetails = error?.details || (error?.message && is422Error ? [error.message] : [])
  
  if (is422Error && validationDetails && validationDetails.length > 0) {
    const validationErrors = parse422Errors(validationDetails)
    
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <AlertTitle>Validation Error (422)</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="space-y-2">
                {validationErrors.map((err, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Badge variant="destructive" className="text-xs">
                      {err.field || 'Field'}
                    </Badge>
                    <div className="text-sm">
                      <div className="font-medium">{err.message}</div>
                      {err.suggestion && (
                        <div className="text-muted-foreground">{err.suggestion}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-2 p-1 hover:bg-destructive/20 rounded"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </Alert>
    )
  }

  // CRM or other non-2xx errors
  const crmError = parseCrmError(error)
  
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <AlertTitle>
            API Error {crmError.status ? `(${crmError.status})` : ''}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <div className="space-y-1">
              {crmError.endpoint && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Endpoint
                  </Badge>
                  <span className="text-sm font-mono">{crmError.endpoint}</span>
                </div>
              )}
              {crmError.status && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Status
                  </Badge>
                  <span className="text-sm">{crmError.status}</span>
                </div>
              )}
              <div className="text-sm mt-2">{crmError.message}</div>
            </div>
          </AlertDescription>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-2 p-1 hover:bg-destructive/20 rounded"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </Alert>
  )
}