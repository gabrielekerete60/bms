
"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

type RevenueChartProps = {
    data: { day: string; revenue: number }[];
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
};

export function RevenueChart({ data }: RevenueChartProps) {
    return (
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
            />
            <YAxis
                tickFormatter={(value) => `₦${value.toLocaleString()}`}
            />
            <ChartTooltip
                content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
            </BarChart>
        </ChartContainer>
    )
}
