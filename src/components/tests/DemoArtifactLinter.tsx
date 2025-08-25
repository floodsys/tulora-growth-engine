import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, AlertCircle, FileSearch } from "lucide-react"

interface LintResult {
  file: string
  line: number
  content: string
  type: 'error' | 'warning'
}

const BANNED_PHRASES = [
  'TechStart Inc',
  'Global Solutions', 
  'Tech Inc',
  'mockOrgs',
  'Acme Corp' // Only flag if it's hardcoded, not from DB
]

export function DemoArtifactLinter() {
  const [lintResults, setLintResults] = useState<LintResult[]>([])
  const [isLinting, setIsLinting] = useState(false)
  const [lastScan, setLastScan] = useState<Date | null>(null)

  const runLint = async () => {
    setIsLinting(true)
    const results: LintResult[] = []

    try {
      // Simulate linting by checking DOM content and some known files
      const bodyText = document.body.textContent || ''
      const htmlContent = document.documentElement.outerHTML

      // Check DOM content for banned phrases
      BANNED_PHRASES.forEach(phrase => {
        if (bodyText.includes(phrase) && phrase !== 'Acme Corp') {
          results.push({
            file: 'DOM Content',
            line: 0,
            content: `Found banned phrase: "${phrase}"`,
            type: 'error'
          })
        }
      })

      // Check for hardcoded Acme Corp (not from database)
      const acmeMatches = htmlContent.match(/['"](Acme Corp)['"]/) 
      if (acmeMatches) {
        results.push({
          file: 'Component Code',
          line: 0,
          content: 'Found hardcoded "Acme Corp" - should come from database',
          type: 'warning'
        })
      }

      // Check for mockOrgs usage
      if (htmlContent.includes('mockOrgs') || bodyText.includes('mockOrgs')) {
        results.push({
          file: 'JavaScript Code',
          line: 0,
          content: 'Found mockOrgs usage - should use real data',
          type: 'error'
        })
      }

      // Check for demo organization IDs
      const demoIds = ['1', '2', '3'] // Simple demo IDs
      demoIds.forEach(id => {
        if (htmlContent.includes(`"id":"${id}"`) || htmlContent.includes(`id: "${id}"`)) {
          results.push({
            file: 'Component State',
            line: 0,
            content: `Found demo organization ID: "${id}"`,
            type: 'error'
          })
        }
      })

      setLintResults(results)
      setLastScan(new Date())

    } catch (error) {
      console.error('Linting failed:', error)
      results.push({
        file: 'Linter',
        line: 0,
        content: `Linting failed: ${error}`,
        type: 'error'
      })
    }

    setIsLinting(false)
  }

  const getStatusIcon = (type: 'error' | 'warning') => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const errorCount = lintResults.filter(r => r.type === 'error').length
  const warningCount = lintResults.filter(r => r.type === 'warning').length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Demo Artifact Linter
        </CardTitle>
        <CardDescription>
          Scans for banned demo organization names and mock data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {lastScan && (
              <div className="text-sm text-muted-foreground">
                Last scan: {lastScan.toLocaleTimeString()}
              </div>
            )}
            {lintResults.length === 0 && lastScan && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Clean</span>
              </div>
            )}
          </div>
          <Button onClick={runLint} disabled={isLinting} size="sm">
            {isLinting ? "Scanning..." : "Run Lint"}
          </Button>
        </div>

        {lintResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-1 text-red-600">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{errorCount} errors</span>
              </div>
              <div className="flex items-center gap-1 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{warningCount} warnings</span>
              </div>
            </div>

            <div className="space-y-2">
              {lintResults.map((result, index) => (
                <div key={index} className="flex items-start gap-2 p-3 rounded-md border bg-muted/50">
                  {getStatusIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{result.file}</div>
                    <div className="text-sm text-muted-foreground break-words">
                      {result.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <strong>Banned phrases:</strong> {BANNED_PHRASES.join(', ')}
        </div>
      </CardContent>
    </Card>
  )
}