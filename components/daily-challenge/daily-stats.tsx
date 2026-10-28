"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Mock data for the stats
const performanceData = [
  { day: "Mon", score: 80, avgScore: 65 },
  { day: "Tue", score: 60, avgScore: 68 },
  { day: "Wed", score: 90, avgScore: 70 },
  { day: "Thu", score: 70, avgScore: 67 },
  { day: "Fri", score: 85, avgScore: 72 },
  { day: "Sat", score: 75, avgScore: 69 },
  { day: "Sun", score: 95, avgScore: 71 },
];

const categoryData = [
  { name: "Science", value: 35 },
  { name: "History", value: 25 },
  { name: "Geography", value: 20 },
  { name: "Entertainment", value: 15 },
  { name: "Sports", value: 5 },
];

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe"];

export function DailyStats() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Your Challenge Stats</CardTitle>
      </CardHeader>

      <Tabs defaultValue="performance">
        <div className="px-6">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="performance" className="m-0">
          <CardContent className="p-4">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value}%`, "Score"]} labelFormatter={(label) => `${label}day`} />
                  <Legend />
                  <Bar name="Your Score" dataKey="score" fill="#8884d8" />
                  <Bar name="Average Score" dataKey="avgScore" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">Your daily challenge performance compared to the average</p>
          </CardContent>
        </TabsContent>

        <TabsContent value="categories" className="m-0">
          <CardContent className="p-4">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, "Percentage"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">Distribution of your correct answers by category</p>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
