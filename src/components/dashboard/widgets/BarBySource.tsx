import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"

interface BarBySourceProps {
  title: string
  data: Array<{ source: string; leads: number }>
  loading?: boolean
  color?: string
}

export function BarBySource({ title, data, loading, color = "hsl(var(--primary))" }: BarBySourceProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
          <BarChart data={data}>
            <XAxis 
              dataKey="source" 
              className="text-xs text-muted-foreground/60"
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              className="text-xs text-muted-foreground/60"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 4px 12px hsl(var(--muted) / 0.15)"
              }}
              cursor={{ fill: "hsl(var(--muted) / 0.2)" }}
            />
            <Bar 
              dataKey="leads" 
              fill={color}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}