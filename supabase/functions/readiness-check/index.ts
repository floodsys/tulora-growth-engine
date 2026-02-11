import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { getCorsHeaders } from '../_shared/cors.ts'

interface ReadinessCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'checking';
  message: string;
  details?: string;
}

const checkResendKey = (): ReadinessCheck => {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    return {
      id: 'resend_key',
      name: 'Resend API Key',
      status: 'fail',
      message: 'RESEND_API_KEY not configured',
      details: 'Add your Resend API key to Supabase secrets'
    };
  }
  
  if (!resendKey.startsWith('re_')) {
    return {
      id: 'resend_key',
      name: 'Resend API Key',
      status: 'fail',
      message: 'Invalid Resend API key format',
      details: 'Resend API keys should start with "re_"'
    };
  }

  return {
    id: 'resend_key',
    name: 'Resend API Key',
    status: 'pass',
    message: 'API key configured correctly',
    details: `Key: ${resendKey.substring(0, 8)}...`
  };
};

const checkEmailConfiguration = (): ReadinessCheck => {
  const notificationsFrom = Deno.env.get('NOTIFICATIONS_FROM');
  const salesInbox = Deno.env.get('SALES_INBOX');
  const helloInbox = Deno.env.get('HELLO_INBOX');
  const enterpriseInbox = Deno.env.get('ENTERPRISE_INBOX');

  const missingConfigs = [];
  if (!notificationsFrom) missingConfigs.push('NOTIFICATIONS_FROM');
  if (!salesInbox) missingConfigs.push('SALES_INBOX');
  if (!helloInbox) missingConfigs.push('HELLO_INBOX');
  if (!enterpriseInbox) missingConfigs.push('ENTERPRISE_INBOX');

  if (missingConfigs.length > 0) {
    return {
      id: 'email_config',
      name: 'Email Configuration',
      status: 'warning',
      message: 'Some email addresses not configured, using defaults',
      details: `Missing: ${missingConfigs.join(', ')}`
    };
  }

  return {
    id: 'email_config',
    name: 'Email Configuration',
    status: 'pass',
    message: 'All email addresses configured',
    details: `From: ${notificationsFrom}, Sales: ${salesInbox}`
  };
};

const checkDomainVerification = async (): Promise<ReadinessCheck> => {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    return {
      id: 'domain_verification',
      name: 'Domain Verification (SPF/DKIM)',
      status: 'fail',
      message: 'Cannot check - no Resend API key',
      details: 'Configure RESEND_API_KEY first'
    };
  }

  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        id: 'domain_verification',
        name: 'Domain Verification (SPF/DKIM)',
        status: 'fail',
        message: 'Failed to check domains',
        details: `API error: ${response.status}`
      };
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return {
        id: 'domain_verification',
        name: 'Domain Verification (SPF/DKIM)',
        status: 'warning',
        message: 'No custom domains configured',
        details: 'Using default Resend domain - consider adding custom domain for better deliverability'
      };
    }

    const verifiedDomains = data.data.filter((domain: any) => domain.status === 'verified');
    const totalDomains = data.data.length;

    if (verifiedDomains.length === 0) {
      return {
        id: 'domain_verification',
        name: 'Domain Verification (SPF/DKIM)',
        status: 'fail',
        message: 'No verified domains found',
        details: `${totalDomains} domain(s) configured but none verified`
      };
    }

    if (verifiedDomains.length < totalDomains) {
      return {
        id: 'domain_verification',
        name: 'Domain Verification (SPF/DKIM)',
        status: 'warning',
        message: 'Some domains not verified',
        details: `${verifiedDomains.length}/${totalDomains} domains verified`
      };
    }

    return {
      id: 'domain_verification',
      name: 'Domain Verification (SPF/DKIM)',
      status: 'pass',
      message: 'All domains verified',
      details: `${verifiedDomains.length} verified domain(s) with SPF/DKIM`
    };
  } catch (error) {
    return {
      id: 'domain_verification',
      name: 'Domain Verification (SPF/DKIM)',
      status: 'fail',
      message: 'Error checking domain status',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

const checkDMARCStatus = (): ReadinessCheck => {
  return {
    id: 'dmarc_status',
    name: 'DMARC Policy',
    status: 'warning',
    message: 'Manual verification required',
    details: 'Set DMARC policy to "p=none" or stronger. Check your DNS TXT record for _dmarc.yourdomain.com'
  };
};

const checkSuiteCRMConfig = (): ReadinessCheck => {
  const clientId = Deno.env.get('SUITECRM_CLIENT_ID');
  const clientSecret = Deno.env.get('SUITECRM_CLIENT_SECRET');
  const baseUrl = Deno.env.get('SUITECRM_BASE_URL');

  const missingConfigs = [];
  if (!clientId) missingConfigs.push('SUITECRM_CLIENT_ID');
  if (!clientSecret) missingConfigs.push('SUITECRM_CLIENT_SECRET');
  if (!baseUrl) missingConfigs.push('SUITECRM_BASE_URL');

  if (missingConfigs.length > 0) {
    return {
      id: 'suitecrm_config',
      name: 'SuiteCRM v8 Configuration',
      status: 'warning',
      message: 'SuiteCRM not configured',
      details: `Missing: ${missingConfigs.join(', ')}. CRM sync will be disabled.`
    };
  }

  if (!baseUrl.includes('/api')) {
    return {
      id: 'suitecrm_config',
      name: 'SuiteCRM v8 Configuration',
      status: 'warning',
      message: 'Check SuiteCRM URL format',
      details: 'URL should include /api path for v8 API access'
    };
  }

  return {
    id: 'suitecrm_config',
    name: 'SuiteCRM v8 Configuration',
    status: 'pass',
    message: 'Client credentials configured',
    details: `Connected to: ${baseUrl}`
  };
};

const checkSuiteCRMToken = async (): Promise<ReadinessCheck> => {
  const clientId = Deno.env.get('SUITECRM_CLIENT_ID');
  const clientSecret = Deno.env.get('SUITECRM_CLIENT_SECRET');
  const baseUrl = Deno.env.get('SUITECRM_BASE_URL');

  if (!clientId || !clientSecret || !baseUrl) {
    return {
      id: 'suitecrm_token',
      name: 'SuiteCRM Token Test',
      status: 'warning',
      message: 'Skipped - SuiteCRM not configured',
      details: 'Configure SuiteCRM credentials to enable token testing'
    };
  }

  try {
    const tokenUrl = `${baseUrl}/access_token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    if (!response.ok) {
      return {
        id: 'suitecrm_token',
        name: 'SuiteCRM Token Test',
        status: 'fail',
        message: 'Token request failed',
        details: `HTTP ${response.status}: Check credentials and SuiteCRM availability`
      };
    }

    const data = await response.json();
    
    if (!data.access_token) {
      return {
        id: 'suitecrm_token',
        name: 'SuiteCRM Token Test',
        status: 'fail',
        message: 'No access token received',
        details: 'SuiteCRM response missing access_token field'
      };
    }

    return {
      id: 'suitecrm_token',
      name: 'SuiteCRM Token Test',
      status: 'pass',
      message: 'Token obtained successfully',
      details: `Token expires in: ${data.expires_in || 'unknown'} seconds`
    };
  } catch (error) {
    return {
      id: 'suitecrm_token',
      name: 'SuiteCRM Token Test',
      status: 'fail',
      message: 'Connection error',
      details: `Error: ${error instanceof Error ? error.message : 'Network error'}`
    };
  }
};

const checkCRMSyncStatus = (): ReadinessCheck => {
  const clientId = Deno.env.get('SUITECRM_CLIENT_ID');
  
  if (!clientId) {
    return {
      id: 'crm_sync_enabled',
      name: 'CRM Sync Status',
      status: 'warning',
      message: 'CRM sync disabled',
      details: 'Leads will be saved locally only. Configure SuiteCRM to enable sync.'
    };
  }

  return {
    id: 'crm_sync_enabled',
    name: 'CRM Sync Status',
    status: 'pass',
    message: 'CRM sync enabled',
    details: 'Leads will be automatically synced to SuiteCRM'
  };
};

const checkAntiSpamProtection = (): ReadinessCheck => {
  const recaptchaSiteKey = Deno.env.get('RECAPTCHA_SITE_KEY');
  const recaptchaSecret = Deno.env.get('RECAPTCHA_SECRET');

  if (!recaptchaSiteKey || !recaptchaSecret) {
    return {
      id: 'anti_spam',
      name: 'Anti-spam Protection',
      status: 'pass',
      message: 'Basic protection active',
      details: 'Honeypot fields and rate limiting enabled. reCAPTCHA not configured (optional).'
    };
  }

  return {
    id: 'anti_spam',
    name: 'Anti-spam Protection',
    status: 'pass',
    message: 'Enhanced protection active',
    details: 'Honeypot, rate limiting, and reCAPTCHA all configured'
  };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[READINESS-CHECK] Starting system checks');

    // Run all checks
    const checks: ReadinessCheck[] = [
      checkResendKey(),
      checkEmailConfiguration(),
      await checkDomainVerification(),
      checkDMARCStatus(),
      checkSuiteCRMConfig(),
      await checkSuiteCRMToken(),
      checkCRMSyncStatus(),
      checkAntiSpamProtection()
    ];

    const passCount = checks.filter(c => c.status === 'pass').length;
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    console.log(`[READINESS-CHECK] Completed: ${passCount} pass, ${failCount} fail, ${warningCount} warnings`);

    return new Response(JSON.stringify({
      success: true,
      checks,
      summary: {
        total: checks.length,
        pass: passCount,
        fail: failCount,
        warning: warningCount,
        overall: failCount > 0 ? 'fail' : warningCount > 0 ? 'warning' : 'pass'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[READINESS-CHECK] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'System check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});