"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// Sample data
const data = [
  { date: "Jan", earnings: 12 },
  { date: "Feb", earnings: 18 },
  { date: "Mar", earnings: 15 },
  { date: "Apr", earnings: 22 },
  { date: "May", earnings: 28 },
  { date: "Jun", earnings: 35 },
]

export function EarningsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings Overview</CardTitle>
        <CardDescription>Your earnings over the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            earnings: {
              label: "Earnings",
              color: "hsl(var(--chart-1))",
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="date" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="earnings"
                stroke="var(--color-earnings)"
                strokeWidth={2}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
