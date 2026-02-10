import { useEffect, useRef, useCallback, useState } from 'react'
import { getTurnstileSiteKey } from '@/config/turnstile'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
export interface TurnstileWidgetProps {
    /** Called with a valid Turnstile token once the challenge is solved. */
    onToken: (token: string) => void
    /** Called when the token expires — parent should clear its stored token. */
    onExpire?: () => void
    /** Called on widget error — parent should clear its stored token. */
    onError?: () => void
    /**
     * Pass a callback-ref so the parent can call `resetRef.current()` to
     * programmatically reset the widget (e.g. after successful submit).
     */
    resetRef?: React.MutableRefObject<(() => void) | null>
    className?: string
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function TurnstileWidget({
    onToken,
    onExpire,
    onError,
    resetRef,
    className = '',
}: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<string | null>(null)
    const [siteKeyMissing, setSiteKeyMissing] = useState(false)

    const siteKey = getTurnstileSiteKey()

    /* ---- reset helper exposed to parent via resetRef ---- */
    const reset = useCallback(() => {
        if (widgetIdRef.current && window.turnstile) {
            try {
                window.turnstile.reset(widgetIdRef.current)
            } catch {
                // ignore — widget may already be removed
            }
        }
    }, [])

    useEffect(() => {
        if (resetRef) resetRef.current = reset
    }, [reset, resetRef])

    /* ---- render widget once turnstile global is available ---- */
    useEffect(() => {
        if (!siteKey) {
            setSiteKeyMissing(true)
            return
        }

        const container = containerRef.current
        if (!container) return

        let cancelled = false
        let timerId: ReturnType<typeof setTimeout> | undefined

        const tryRender = () => {
            if (cancelled) return
            if (!window.turnstile) {
                timerId = setTimeout(tryRender, 150)
                return
            }

            // Avoid double-render
            if (widgetIdRef.current) return

            try {
                const id = window.turnstile.render(container, {
                    sitekey: siteKey,
                    callback: onToken,
                    'expired-callback': () => onExpire?.(),
                    'error-callback': () => onError?.(),
                })
                widgetIdRef.current = id
            } catch (err) {
                console.error('[TurnstileWidget] render error', err)
                onError?.()
            }
        }

        tryRender()

        return () => {
            cancelled = true
            if (timerId) clearTimeout(timerId)
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current)
                } catch {
                    // ignore
                }
                widgetIdRef.current = null
            }
        }
        // We intentionally omit callback deps — they are stable refs from the parent.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteKey])

    /* ---- missing-key guard (production only) ---- */
    if (siteKeyMissing) {
        return (
            <div className="text-sm text-destructive text-center py-2">
                Turnstile site key is not configured. Contact form submissions are disabled.
            </div>
        )
    }

    return <div ref={containerRef} className={className} />
}
