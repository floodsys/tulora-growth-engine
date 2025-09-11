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

export function ApiErrorPanel({ error, onDismiss }: ApiErrorPanelProps) {
  // Enhanced 422 error parsing for structured error arrays
  const parse422Errors = (error: any): ValidationError[] => {
    const errors: ValidationError[] = []
    
    // Handle new structured format
    if (error.unknown_fields && Array.isArray(error.unknown_fields)) {
      error.unknown_fields.forEach((field: string) => {
        errors.push({
          field,
          message: `Remove unknown field: "${field}"`,
          suggestion: 'This field is not allowed'
        })
      })
    }
    
    if (error.missing_required && Array.isArray(error.missing_required)) {
      error.missing_required.forEach((field: string) => {
        errors.push({
          field,
          message: `Missing required field: "${field}"`,
          suggestion: 'This field must be provided'
        })
      })
    }
    
    if (error.enum_errors && Array.isArray(error.enum_errors)) {
      error.enum_errors.forEach((enumError: any) => {
        errors.push({
          field: enumError.field,
          message: `Invalid value for "${enumError.field}": "${enumError.value}"`,
          suggestion: `Allowed values: ${enumError.allowed.join(', ')}`
        })
      })
    }
    
    // Handle both new structured format (array of {field, message}) and legacy format (array of strings)
    if (errors.length === 0 && error.details && Array.isArray(error.details)) {
      for (const detail of error.details) {
        if (typeof detail === 'object' && detail.field && detail.message) {
          // New structured format from frontend validation
          errors.push({
            field: detail.field,
            message: detail.message,
            suggestion: detail.field === 'product_interest' ? 'Select valid product options' : 'Check field requirements'
          });
        } else {
          // Legacy string format - parse manually
          const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
          
          if (detailStr.includes('Unknown fields:')) {
            const fields = detailStr.replace('Unknown fields: ', '').split(', ')
            for (const field of fields) {
              errors.push({
                field,
                message: `Remove: "${field}"`,
                suggestion: 'Field not allowed'
              })
            }
          } else if (detailStr.includes('inquiry_type')) {
            if (detailStr.includes('is required')) {
              errors.push({
                field: 'inquiry_type',
                message: 'inquiry_type is required',
                suggestion: 'must be "contact" or "enterprise"'
              })
            } else if (detailStr.includes('must be either')) {
              errors.push({
                field: 'inquiry_type',
                message: 'Invalid inquiry_type value',
                suggestion: 'must be "contact" or "enterprise"'
              })
            }
          } else if (detailStr.includes('full_name is required')) {
            errors.push({
              field: 'full_name',
              message: 'full_name is required',
              suggestion: 'Must provide a name'
            })
          } else if (detailStr.includes('email is required')) {
            errors.push({
              field: 'email',
              message: 'email is required',
              suggestion: 'Must provide a valid email'
            })
          } else if (detailStr.includes('message is required')) {
            errors.push({
              field: 'message',
              message: 'message is required',
              suggestion: 'Must provide a message'
            })
          } else if (detailStr.includes('product_interest')) {
            if (detailStr.includes('Product interest is required')) {
              errors.push({
                field: 'product_interest',
                message: 'Product interest is required for enterprise inquiries',
                suggestion: 'Select at least one product option'
              })
            } else if (detailStr.includes('Invalid product interest values')) {
              errors.push({
                field: 'product_interest',
                message: detailStr,
                suggestion: 'Must be "AI Lead Generation" or "AI Customer Service"'
              })
            } else if (detailStr.includes('must be either')) {
              errors.push({
                field: 'product_interest',
                message: 'Product interest must be either "AI Lead Generation" or "AI Customer Service"',
                suggestion: 'Select a valid product option'
              })
            }
          } else {
            errors.push({
              message: detailStr,
              suggestion: 'Check field format and requirements'
            })
          }
        }
      }
    } else if (errors.length === 0 && error.details && typeof error.details === 'string') {
      // Handle single string detail
      errors.push({
        message: error.details,
        suggestion: 'Check field format and requirements'
      });
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
  
  if (is422Error) {
    const validationErrors = parse422Errors(error)
    
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