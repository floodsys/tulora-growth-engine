import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSuspensionCheck } from './useSuspensionCheck';

interface UseOrganizationActionsReturn {
  isBlocked: boolean;
  organizationStatus: string | undefined;
  checkActionAllowed: (action: string) => { allowed: boolean; reason?: string };
  showBlockedModal: () => void;
}

export function useOrganizationActions(): UseOrganizationActionsReturn {
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();
  const { 
    organization, 
    isBlocked, 
    isSuspended, 
    isCanceled, 
    isOwnerOrAdmin, 
    permissions 
  } = useSuspensionCheck();

  const checkActionAllowed = (action: string) => {
    const actionMap: Record<string, boolean> = {
      'create_agent': permissions.canCreateAgents,
      'make_call': permissions.canMakeCalls,
      'create_invite': permissions.canCreateInvites,
      'access_api': permissions.canAccessAPI,
      'access_webhooks': permissions.canAccessWebhooks,
      'access_settings': permissions.canAccessSettings,
      'access_billing': permissions.canAccessBilling,
    };

    const allowed = actionMap[action] ?? true;
    
    if (!allowed) {
      const reason = isCanceled 
        ? 'Service has been canceled'
        : 'Service is currently suspended';
      return { allowed: false, reason };
    }

    return { allowed: true };
  };

  const showBlockedModal = () => {
    if (isBlocked) {
      setShowModal(true);
    } else {
      toast({
        title: "Action not allowed",
        description: "This action is currently restricted.",
        variant: "destructive",
      });
    }
  };

  return {
    isBlocked,
    organizationStatus: organization?.status,
    checkActionAllowed,
    showBlockedModal,
  };
}