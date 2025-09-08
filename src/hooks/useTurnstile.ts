import { useState, useEffect, useCallback } from "react";
import { TURNSTILE_SITE_KEY } from "@/config/turnstile";
import { useToast } from "@/hooks/use-toast";

interface TurnstileOptions {
  onSuccess?: (token: string) => void;
  onError?: () => void;
  onExpired?: () => void;
}

export const useTurnstile = (containerId: string, options: TurnstileOptions = {}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [token, setToken] = useState<string>("");
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if script is already loaded
  const isScriptLoaded = useCallback(() => {
    return typeof window !== 'undefined' && 
           window.turnstile && 
           document.querySelector('script[src*="turnstile"]');
  }, []);

  // Load Turnstile script
  useEffect(() => {
    if (isScriptLoaded()) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => {
      toast({
        title: "Security widget failed to load",
        description: "Please refresh the page and try again",
        variant: "destructive"
      });
    };
    
    document.head.appendChild(script);

    return () => {
      // Only remove if this is the last component using it
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [isScriptLoaded, toast]);

  // Initialize widget when script loads
  useEffect(() => {
    if (!isLoaded || !window.turnstile || widgetId) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const id = window.turnstile.render(`#${containerId}`, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          setToken(token);
          options.onSuccess?.(token);
        },
        'error-callback': () => {
          setToken('');
          options.onError?.();
          toast({
            title: "Verification failed",
            description: "Please try the verification again",
            variant: "destructive"
          });
        },
        'expired-callback': () => {
          setToken('');
          options.onExpired?.();
        }
      });
      
      setWidgetId(id);
    } catch (error) {
      console.error('Turnstile render error:', error);
      toast({
        title: "Security verification unavailable",
        description: "Please refresh the page to try again",
        variant: "destructive"
      });
    }
  }, [isLoaded, containerId, widgetId, options, toast]);

  // Reset widget
  const reset = useCallback(() => {
    if (widgetId && window.turnstile) {
      try {
        window.turnstile.reset(widgetId);
        setToken('');
      } catch (error) {
        console.error('Turnstile reset error:', error);
      }
    }
  }, [widgetId]);

  return {
    isLoaded,
    token,
    reset,
    isReady: isLoaded && !!widgetId
  };
};

// Global Turnstile type definition
declare global {
  interface Window {
    turnstile: {
      render: (element: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
      }) => string;
      reset: (widgetId?: string) => void;
    };
  }
}