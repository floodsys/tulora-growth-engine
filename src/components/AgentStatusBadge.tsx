/**
 * AgentStatusBadge Component
 * 
 * Displays the current status of an agent with appropriate styling and icon.
 */

import { Badge } from "@/components/ui/badge"
import { 
  FileEdit, 
  TestTube, 
  CheckCircle, 
  PauseCircle, 
  Archive 
} from "lucide-react"
import { 
  AgentStatusType, 
  AgentStatus, 
  AGENT_STATUS_DISPLAY, 
  normalizeAgentStatus 
} from "@/lib/agents/types"

interface AgentStatusBadgeProps {
  status: string
  showDescription?: boolean
  className?: string
}

const STATUS_ICONS = {
  [AgentStatus.DRAFT]: FileEdit,
  [AgentStatus.TESTING]: TestTube,
  [AgentStatus.ACTIVE]: CheckCircle,
  [AgentStatus.PAUSED]: PauseCircle,
  [AgentStatus.ARCHIVED]: Archive,
}

const STATUS_COLORS: Record<AgentStatusType, string> = {
  [AgentStatus.DRAFT]: "bg-slate-100 text-slate-700 border-slate-300",
  [AgentStatus.TESTING]: "bg-amber-100 text-amber-700 border-amber-300",
  [AgentStatus.ACTIVE]: "bg-green-100 text-green-700 border-green-300",
  [AgentStatus.PAUSED]: "bg-orange-100 text-orange-700 border-orange-300",
  [AgentStatus.ARCHIVED]: "bg-red-100 text-red-700 border-red-300",
}

export function AgentStatusBadge({ 
  status, 
  showDescription = false, 
  className = "" 
}: AgentStatusBadgeProps) {
  const normalizedStatus = normalizeAgentStatus(status)
  const display = AGENT_STATUS_DISPLAY[normalizedStatus]
  const Icon = STATUS_ICONS[normalizedStatus]
  const colorClass = STATUS_COLORS[normalizedStatus]
  
  return (
    <div className={`inline-flex flex-col ${className}`}>
      <Badge 
        variant="outline"
        className={`${colorClass} border inline-flex items-center gap-1.5`}
      >
        <Icon className="h-3 w-3" />
        {display.label}
      </Badge>
      {showDescription && (
        <span className="text-xs text-muted-foreground mt-1">
          {display.description}
        </span>
      )}
    </div>
  )
}

export default AgentStatusBadge
