
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { CheckCircle, Users, Loader2, Calendar as CalendarIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { collection, getDocs, query, where, Timestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, startOfWeek, endOfDay, startOfDay, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";


const chartConfig = {
  days: {
    label: "Days",
    color: "hsl(var(--chart-1))",
  },
};

type AttendanceRecord = {
    id: string;
    staff_id: string;
    staff_name: string;
    clock_in_time: Timestamp;
    clock_out_time: Timestamp | null;
}

type WeeklyAttendance = {
    name: string;
    days: number;
}

export default function AttendancePage() {
  const [todaysActivity, setTodaysActivity] = useState<AttendanceRecord[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>();
  const [tempDate, setTempDate] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    
    try {
        const staffQuery = query(collection(db, 'staff'), where('role', '!=', 'Developer'));
        const staffSnapshot = await getDocs(staffQuery);
        const staffMap = new Map(staffSnapshot.docs.map(doc => [doc.id, doc.data().name]));

        // Fetch today's attendance for "Today's Activity" card
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        
        const todayQuery = query(
            collection(db, "attendance"),
            where("clock_in_time", ">=", Timestamp.fromDate(todayStart)),
            where("clock_in_time", "<=", Timestamp.fromDate(todayEnd))
        );
        const todayAttendanceSnapshot = await getDocs(todayQuery);
        const todayRecords = todayAttendanceSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                staff_name: staffMap.get(data.staff_id) || 'Unknown Staff'
            } as AttendanceRecord
        }).filter(record => staffMap.has(record.staff_id)); // Ensure developer records are filtered out
        setTodaysActivity(todayRecords);
        
        // Fetch all attendance for logs
        const allAttendanceQuery = query(collection(db, 'attendance'), orderBy('clock_in_time', 'desc'));
        const allAttendanceSnapshot = await getDocs(allAttendanceQuery);
        const allRecords = allAttendanceSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                staff_name: staffMap.get(data.staff_id) || 'Unknown Staff'
            } as AttendanceRecord
        }).filter(record => staffMap.has(record.staff_id)); // Ensure developer records are filtered out
        setAllAttendance(allRecords);


        // Fetch this week's attendance for the chart
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
        const weekQuery = query(
            collection(db, "attendance"),
            where("clock_in_time", ">=", Timestamp.fromDate(weekStart))
        );
        const weekAttendanceSnapshot = await getDocs(weekQuery);
        
        const attendanceByStaff: { [staffId: string]: Set<string> } = {};

        weekAttendanceSnapshot.docs.forEach(doc => {
            const record = doc.data();
             if (!staffMap.has(record.staff_id)) return; // Skip developer records
            const dateStr = record.clock_in_time.toDate().toISOString().split('T')[0];
            if (!attendanceByStaff[record.staff_id]) {
                attendanceByStaff[record.staff_id] = new Set();
            }
            attendanceByStaff[record.staff_id].add(dateStr);
        });
        
        const chartData = Array.from(staffMap.entries())
            .map(([staffId, name]) => ({
                name: name.split(' ')[0], // Use first name for chart
                days: attendanceByStaff[staffId]?.size || 0,
            }));

        setWeeklyData(chartData);

    } catch (error) {
        console.error("Error fetching attendance: ", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const filteredLogs = useMemo(() => {
    if (!date?.from) {
        return allAttendance;
    }

    const from = startOfDay(date.from);
    const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
    
    return allAttendance.filter(log => {
        const logDate = log.clock_in_time.toDate();
        return logDate >= from && logDate <= to;
    });
  }, [allAttendance, date]);
  
  const handleDateApply = () => {
    setDate(tempDate);
    setIsDatePopoverOpen(false);
  }

  useEffect(() => {
    fetchAttendance();
    window.addEventListener('attendanceChanged', fetchAttendance);
    window.addEventListener('focus', fetchAttendance);
    
    return () => {
        window.removeEventListener('attendanceChanged', fetchAttendance);
        window.removeEventListener('focus', fetchAttendance);
    }
  }, [fetchAttendance]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold font-headline">Staff Attendance</h1>

        <Tabs defaultValue="overview">
            <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="logs">Attendance Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="text-green-500" />
                        Today's Activity
                        </CardTitle>
                        <CardDescription>
                        Staff members who have clocked in on {today}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="md:hidden space-y-4">
                            {isLoading ? (
                                <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                            ) : todaysActivity.length === 0 ? (
                                <p className="text-center text-muted-foreground py-12">No staff activity recorded today.</p>
                            ) : (
                                todaysActivity.map(record => (
                                    <Card key={record.id} className="p-4">
                                        <p className="font-semibold">{record.staff_name}</p>
                                        <div className="text-sm text-muted-foreground">
                                            <span>In: {format(record.clock_in_time.toDate(), 'p')}</span>
                                            <span className="mx-2">|</span>
                                            <span>Out: {record.clock_out_time ? format(record.clock_out_time.toDate(), 'p') : '--'}</span>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Staff Member</TableHead>
                            <TableHead>Clock-in Time</TableHead>
                            <TableHead>Clock-out Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : todaysActivity.length > 0 ? (
                                todaysActivity.map(record => (
                                    <TableRow key={record.id}>
                                        <TableCell>{record.staff_name}</TableCell>
                                        <TableCell>{format(record.clock_in_time.toDate(), 'p')}</TableCell>
                                        <TableCell>{record.clock_out_time ? format(record.clock_out_time.toDate(), 'p') : '--'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No staff activity recorded today.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        </Table>
                        </div>
                    </CardContent>
                    </Card>

                    <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <Users />
                        Weekly Attendance
                        </CardTitle>
                        <CardDescription>
                        Number of days each staff member clocked in this week.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : (
                            <ChartContainer config={chartConfig} className="h-64 w-full">
                                <BarChart
                                    accessibilityLayer
                                    data={weeklyData}
                                    margin={{ top: 20, right: 20, left: -10, bottom: 0 }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                    dataKey="name"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    />
                                    <YAxis 
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={10}
                                        allowDecimals={false}
                                        domain={[0, 5]}
                                    />
                                    <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent indicator="dot" />}
                                    />
                                    <Bar dataKey="days" fill="var(--color-days)" radius={4} />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                    </Card>
                </div>
            </TabsContent>
             <TabsContent value="logs" className="mt-4">
                <Card>
                     <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                            <div>
                               <CardTitle>Attendance Log</CardTitle>
                               <CardDescription>A complete history of all clock-in and clock-out events.</CardDescription>
                            </div>
                             <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                    "w-full sm:w-[260px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date?.from ? (
                                    date.to ? (
                                        <>
                                        {format(date.from, "LLL dd, y")} -{" "}
                                        {format(date.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(date.from, "LLL dd, y")
                                    )
                                    ) : (
                                    <span>Pick a date range</span>
                                    )}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={tempDate?.from}
                                    selected={tempDate}
                                    onSelect={setTempDate}
                                    numberOfMonths={2}
                                />
                                 <div className="p-2 border-t flex justify-end">
                                    <Button onClick={handleDateApply}>Apply</Button>
                                </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="md:hidden space-y-4">
                             {isLoading ? (
                                <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                            ) : filteredLogs.length === 0 ? (
                                <p className="text-center text-muted-foreground py-12">No attendance records for this period.</p>
                            ) : (
                                filteredLogs.map(record => {
                                    let hours = 'N/A';
                                    if (record.clock_out_time) {
                                        const diff = record.clock_out_time.toMillis() - record.clock_in_time.toMillis();
                                        hours = (diff / (1000 * 60 * 60)).toFixed(2);
                                    }
                                    return (
                                        <Card key={record.id} className="p-4 space-y-2">
                                            <p className="font-semibold">{record.staff_name}</p>
                                            <p className="text-sm text-muted-foreground">{format(record.clock_in_time.toDate(), 'PPP')}</p>
                                            <div className="text-sm pt-2 border-t space-y-1">
                                                <div className="flex justify-between"><span>Clock-in:</span><span>{format(record.clock_in_time.toDate(), 'p')}</span></div>
                                                <div className="flex justify-between"><span>Clock-out:</span><span>{record.clock_out_time ? format(record.clock_out_time.toDate(), 'p') : '--'}</span></div>
                                                <div className="flex justify-between font-bold"><span>Total Hours:</span><span>{hours}</span></div>
                                            </div>
                                        </Card>
                                    )
                                })
                            )}
                        </div>
                         <div className="hidden md:block overflow-x-auto">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Staff Member</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Clock-in</TableHead>
                                    <TableHead>Clock-out</TableHead>
                                    <TableHead>Total Hours</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                 {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="h-8 w-8 animate-spin" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length > 0 ? (
                                    filteredLogs.map(record => {
                                        let hours = 'N/A';
                                        if (record.clock_out_time) {
                                            const diff = record.clock_out_time.toMillis() - record.clock_in_time.toMillis();
                                            hours = (diff / (1000 * 60 * 60)).toFixed(2);
                                        }
                                        return (
                                            <TableRow key={record.id}>
                                                <TableCell>{record.staff_name}</TableCell>
                                                <TableCell>{format(record.clock_in_time.toDate(), 'PPP')}</TableCell>
                                                <TableCell>{format(record.clock_in_time.toDate(), 'p')}</TableCell>
                                                <TableCell>
                                                    {record.clock_out_time ? format(record.clock_out_time.toDate(), 'p') : '--'}
                                                </TableCell>
                                                <TableCell>{hours}</TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No attendance records found for the selected period.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                         </div>
                    </CardContent>
                     <CardFooter>
                        <div className="text-xs text-muted-foreground">
                            Showing <strong>{filteredLogs.length}</strong> of <strong>{allAttendance.length}</strong> records.
                        </div>
                    </CardFooter>
                </Card>
            </TabsContent>
        </Tabs>
     
    </div>
  );
}
