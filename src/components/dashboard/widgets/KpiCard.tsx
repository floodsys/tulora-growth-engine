import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    isPositive: boolean
  }
  icon?: React.ComponentType<{ className?: string }>
  loading?: boolean
  className?: string
}

export function KpiCard({ title, value, change, icon: Icon, loading, className }: KpiCardProps) {
  if (loading) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-12" />
      </Card>
    )
  }

  return (
    <Card className={cn("p-6 hover:bg-card-hover transition-colors", className)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      
      <div className="space-y-1">
        <p className="text-2xl font-bold">{value}</p>
        
        {change && (
          <div className="flex items-center gap-1 text-xs">
            {change.isPositive ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span className={change.isPositive ? "text-success" : "text-destructive"}>
              {Math.abs(change.value)}%
            </span>
            <span className="text-muted-foreground">from last period</span>
          </div>
        )}
      </div>
    </Card>
  )
}