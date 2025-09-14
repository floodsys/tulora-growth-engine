import { useEffect, useRef, useState } from 'react'
import { getTurnstileSiteKey } from '@/config/turnstile'

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onError?: () => void
  onExpire?: () => void
  className?: string
}

export const TurnstileWidget = ({
  onVerify,
  onError,
  onExpire,
  className = ''
}: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)
  const siteKey = getTurnstileSiteKey()

  useEffect(() => {
    const loadScript = () => {
      if (document.querySelector('script[src*="challenges.cloudflare.com"]')) {
        setIsReady(true)
        return
      }

      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      script.onload = () => setIsReady(true)
      document.head.appendChild(script)
    }

    loadScript()
  }, [])

  useEffect(() => {
    if (!isReady || !containerRef.current) {
      return
    }

    // Wait for turnstile to be available
    const checkTurnstile = () => {
      if (window.turnstile) {
        window.turnstile.render(containerRef.current!, {
          sitekey: siteKey,
          callback: onVerify,
          'error-callback': onError,
          'expired-callback': onExpire
        })
      } else {
        setTimeout(checkTurnstile, 100)
      }
    }

    checkTurnstile()
  }, [isReady, siteKey, onVerify, onError, onExpire])

  return (
    <div className={className}>
      <div ref={containerRef} />
      {!isReady && (
        <div className="h-16 bg-muted animate-pulse rounded-md flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Loading security check...</span>
        </div>
      )}
    </div>
  )
}