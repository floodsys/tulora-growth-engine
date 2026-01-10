/**
 * AgentStatusActions Component
 * 
 * Displays transition action buttons for an agent based on its current status.
 * Only shows buttons for valid state transitions.
 */

import { Button } from "@/components/ui/button"
import { 
  TestTube, 
  Rocket, 
  PauseCircle, 
  PlayCircle,
  Archive,
  FileEdit
} from "lucide-react"
import { 
  AgentStatusType, 
  AgentStatus, 
  normalizeAgentStatus,
  getAllowedTransitions,
  getTransitionLabel,
  canEditAgent
} from "@/lib/agents/types"

interface AgentStatusActionsProps {
  status: string
  onTransition: (toStatus: AgentStatusType) => void
  onPublish?: () => void
  loading?: boolean
  disabled?: boolean
}

// Button configurations for each transition
const TRANSITION_BUTTONS: Record<string, {
  icon: typeof TestTube
  variant: "default" | "outline" | "secondary" | "destructive"
}> = {
  [`_${AgentStatus.TESTING}`]: { 
    icon: TestTube, 
    variant: "secondary" 
  },
  [`_${AgentStatus.ACTIVE}`]: { 
    icon: Rocket, 
    variant: "default" 
  },
  [`_${AgentStatus.PAUSED}`]: { 
    icon: PauseCircle, 
    variant: "outline" 
  },
  [`_${AgentStatus.DRAFT}`]: { 
    icon: FileEdit, 
    variant: "outline" 
  },
  [`_${AgentStatus.ARCHIVED}`]: { 
    icon: Archive, 
    variant: "destructive" 
  },
}

export function AgentStatusActions({ 
  status, 
  onTransition, 
  onPublish,
  loading = false,
  disabled = false 
}: AgentStatusActionsProps) {
  const normalizedStatus = normalizeAgentStatus(status)
  const allowedTransitions = getAllowedTransitions(normalizedStatus)
  
  // No actions available for ARCHIVED agents
  if (normalizedStatus === AgentStatus.ARCHIVED) {
    return (
      <span className="text-sm text-muted-foreground">
        Archived - No actions available
      </span>
    )
  }
  
  // Special handling for TESTING → ACTIVE (uses publish flow)
  const handleTransition = (toStatus: AgentStatusType) => {
    if (toStatus === AgentStatus.ACTIVE && onPublish) {
      // Use publish flow for TESTING → ACTIVE
      onPublish()
    } else {
      onTransition(toStatus)
    }
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {allowedTransitions.map((toStatus) => {
        const config = TRANSITION_BUTTONS[`_${toStatus}`]
        const label = getTransitionLabel(normalizedStatus, toStatus)
        const Icon = config?.icon || PlayCircle
        const variant = config?.variant || "outline"
        
        // Special case: TESTING → ACTIVE should use "Publish" button
        const isPublishAction = 
          normalizedStatus === AgentStatus.TESTING && 
          toStatus === AgentStatus.ACTIVE
        
        return (
          <Button
            key={toStatus}
            variant={variant}
            size="sm"
            onClick={() => handleTransition(toStatus)}
            disabled={loading || disabled}
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </Button>
        )
      })}
      
      {/* ACTIVE agents can re-publish to update config */}
      {normalizedStatus === AgentStatus.ACTIVE && onPublish && (
        <Button
          variant="outline"
          size="sm"
          onClick={onPublish}
          disabled={loading || disabled}
        >
          <Rocket className="h-4 w-4 mr-2" />
          Update Config
        </Button>
      )}
    </div>
  )
}

export default AgentStatusActions
