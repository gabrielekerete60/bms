
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Package2, Car, Users, DollarSign, Filter, MoreVertical, Calendar as CalendarIcon } from 'lucide-react';
import { getSalesRuns, getAllSalesRuns, getSalesStats } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { SalesRun as SalesRunType } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, eachDayOfInterval, subDays, startOfDay, endOfDay } from 'date-fns';
import { RevenueChart } from '@/components/revenue-chart';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";


type User = {
    name: string;
    role: string;
    staff_id: string;
};

const formatCurrency = (amount?: number) => `₦${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function EmptyState({ title, description }: { title: string, description: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
            <Package2 className="h-16 w-16 mb-4" />
            <h3 className="text-xl font-semibold">{title}</h3>
            <p>{description}</p>
        </div>
    );
}

function RunCard({ run }: { run: SalesRunType }) {
    const [soldItems, setSoldItems] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'orders'), where('salesRunId', '==', run.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let totalSold = 0;
            snapshot.forEach(doc => {
                const items = doc.data().items || [];
                totalSold += items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
            });
            setSoldItems(totalSold);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [run.id]);

    const totalItems = run.items.reduce((sum, item) => sum + item.quantity, 0);
    const progress = totalItems > 0 ? (soldItems / totalItems) * 100 : 0;
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Car /> Run: {run.id.substring(0, 6).toUpperCase()}
                    </CardTitle>
                    <CardDescription>Driver: {run.to_staff_name}</CardDescription>
                </div>
                <Badge>{run.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Sales Progress</span>
                         {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <span>{soldItems} / {totalItems} items</span>}
                    </div>
                    <Progress value={progress} />
                </div>
                <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span>Total Revenue:</span><span className="font-semibold">{formatCurrency(run.totalRevenue)}</span></div>
                    <div className="flex justify-between"><span>Total Collected:</span><span className="font-semibold text-green-500">{formatCurrency(run.totalCollected)}</span></div>
                    <div className="flex justify-between"><span>Total Outstanding:</span><span className="font-semibold text-destructive">{formatCurrency(run.totalOutstanding)}</span></div>
                </div>
                <Link href={`/dashboard/sales-runs/${run.id}`} passHref>
                    <Button className="w-full">Manage Run</Button>
                </Link>
            </CardContent>
        </Card>
    );
}

function ManagerView({ allRuns, isLoading, user }: { allRuns: SalesRunType[], isLoading: boolean, user: User | null }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [filterDriver, setFilterDriver] = useState('all');
    const [sort, setSort] = useState('date_desc');
    const [date, setDate] = useState<DateRange | undefined>({ from: subDays(new Date(), 6), to: new Date() });
    const [tempDate, setTempDate] = useState<DateRange | undefined>(date);
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
    
    const showOnlyActive = searchParams.get('status') === 'active';

    const drivers = useMemo(() => {
        const driverSet = new Set(allRuns.map(run => run.to_staff_name).filter(Boolean));
        return ['all', ...Array.from(driverSet)] as string[];
    }, [allRuns]);

    const filteredAndSortedRuns = useMemo(() => {
        let runs = [...allRuns];

        if (showOnlyActive) {
            runs = runs.filter(run => run.status === 'active');
        } else {
             if (filterDriver !== 'all') {
                runs = runs.filter(run => run.to_staff_name === filterDriver);
            }
             if (date?.from) {
                const start = startOfDay(date.from);
                const end = date.to ? endOfDay(date.to) : endOfDay(date.from);
                runs = runs.filter(run => {
                    const runDate = new Date(run.date);
                    return runDate >= start && runDate <= end;
                });
            }
        }
        
        runs.sort((a, b) => {
            switch (sort) {
                case 'value_desc': return b.totalRevenue - a.totalRevenue;
                case 'value_asc': return a.totalRevenue - b.totalRevenue;
                case 'date_asc': return new Date(a.date).getTime() - new Date(b.date).getTime();
                default: return new Date(b.date).getTime() - new Date(a.date).getTime();
            }
        });
        return runs;
    }, [allRuns, filterDriver, sort, date, showOnlyActive]);

    const activeRuns = allRuns.filter(r => r.status === 'active');
    const totalOutstanding = activeRuns.reduce((sum, run) => sum + run.totalOutstanding, 0);

    const weeklySalesChartData = useMemo(() => {
        if (!date?.from) return [];
        const start = date.from;
        const end = date.to || start;
        const daysInInterval = eachDayOfInterval({ start, end });

        const dailySales = daysInInterval.map(day => ({
            day: format(day, 'E'),
            revenue: 0,
        }));

        filteredAndSortedRuns.forEach(run => {
            const runDate = new Date(run.date);
             if (runDate >= start && runDate <= end) {
                const dayOfWeek = format(runDate, 'E');
                const index = dailySales.findIndex(d => d.day === dayOfWeek);
                if (index !== -1) {
                    dailySales[index].revenue += run.totalRevenue;
                }
            }
        });
        
        return dailySales;

    }, [filteredAndSortedRuns, date]);
    
    const handleDateApply = () => {
        setDate(tempDate);
        setIsDatePopoverOpen(false);
    }
    
    const title = showOnlyActive ? 'Active Sales Runs' : 'All Sales Runs';
    const description = showOnlyActive ? 'Monitor all currently active sales runs.' : 'Monitor all active and completed sales runs across all drivers.';


    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <Link href="/dashboard/deliveries?status=active">
                    <Card className="hover:bg-muted/50 transition-colors h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Sales Runs</CardTitle>
                            <Car className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{activeRuns.length}</div>
                        </CardContent>
                    </Card>
                </Link>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                         <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Drivers Active</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{drivers.length > 1 ? drivers.length - 1 : 0}</div>
                    </CardContent>
                </Card>
                 <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                    <PopoverTrigger asChild>
                        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Date Range</CardTitle>
                                <CalendarIcon className="h-4 w-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                            <div className="text-lg font-bold">
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                        {format(date.from, "LLL dd")} - {format(date.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(date.from, "LLL dd, y")
                                    )
                                    ) : (
                                    <span>All time</span>
                                    )}
                            </div>
                            </CardContent>
                        </Card>
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

             <Card className="xl:col-span-2">
              <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                  <CardTitle>Sales Run Performance</CardTitle>
                  <CardDescription>Revenue from sales runs in the selected period.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <RevenueChart data={weeklySalesChartData} />
              </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>{title}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </div>
                         {showOnlyActive ? (
                            <Link href="/dashboard/deliveries">
                                <Button variant="outline">Show All Runs</Button>
                            </Link>
                         ) : (
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline"><Filter className="mr-2"/> Filter & Sort</Button></DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Filter by Driver</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {drivers.map(d => <DropdownMenuItem key={d} onSelect={() => setFilterDriver(d)}>{d === 'all' ? 'All Drivers' : d}</DropdownMenuItem>)}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => setSort('date_desc')}>Newest First</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setSort('date_asc')}>Oldest First</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setSort('value_desc')}>Highest Value</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setSort('value_asc')}>Lowest Value</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                         )}
                    </div>
                </CardHeader>
                <CardContent>
                     {isLoading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                     ) : (
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Driver</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead className="text-right">Value</TableHead>
                                    <TableHead className="text-right">Outstanding</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAndSortedRuns.map(run => (
                                    <TableRow key={run.id} className="cursor-pointer hover:bg-muted" onClick={() => router.push(`/dashboard/sales-runs/${run.id}`)}>
                                        <TableCell>{run.to_staff_name}</TableCell>
                                        <TableCell>{format(new Date(run.date), 'PPP')}</TableCell>
                                        <TableCell><Badge variant={run.status === 'active' ? 'default' : 'secondary'}>{run.status}</Badge></TableCell>
                                        <TableCell>{run.items.reduce((sum, i) => sum + i.quantity, 0)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(run.totalRevenue)}</TableCell>
                                        <TableCell className="text-right text-destructive font-semibold">{formatCurrency(run.totalOutstanding)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                     )}
                </CardContent>
            </Card>
        </div>
    )
}

function DriverView({ user }: { user: User }) {
    const [activeRuns, setActiveRuns] = useState<SalesRunType[]>([]);
    const [completedRuns, setCompletedRuns] = useState<SalesRunType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchRuns = useCallback(async () => {
        setIsLoading(true);
        try {
            const { active, completed } = await getSalesRuns(user.staff_id);
            setActiveRuns(active);
            setCompletedRuns(completed);
        } catch (error) {
            console.error("Error fetching runs:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch sales runs.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast, user.staff_id]);
    
    useEffect(() => {
        if(user.staff_id) fetchRuns();

        window.addEventListener('focus', fetchRuns);
        return () => {
            window.removeEventListener('focus', fetchRuns);
        };
    }, [user, fetchRuns]);
    
    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold font-headline">My Sales Runs</h1>
            
            <Tabs defaultValue="active">
                <TabsList>
                    <TabsTrigger value="active">Active Runs ({activeRuns.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed Runs ({completedRuns.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="active" className="mt-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : activeRuns.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {activeRuns.map(run => <RunCard key={run.id} run={run} />)}
                        </div>
                    ) : (
                        <Card><CardContent className="p-6"><EmptyState title="No Active Sales Runs" description="Accepted sales runs will appear here." /></CardContent></Card>
                    )}
                </TabsContent>
                <TabsContent value="completed" className="mt-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : completedRuns.length > 0 ? (
                         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {completedRuns.map(run => <RunCard key={run.id} run={run} />)}
                        </div>
                    ) : (
                         <Card><CardContent className="p-6"><EmptyState title="No Completed Runs" description="Your completed sales runs will appear here." /></CardContent></Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function DeliveriesPage() {
    const [user, setUser] = useState<User | null>(null);
    const [allRuns, setAllRuns] = useState<SalesRunType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchAllRunsForManager = useCallback(async () => {
        setIsLoading(true);
        try {
            const { active, completed } = await getAllSalesRuns();
            setAllRuns([...active, ...completed]);
        } catch (error: any) {
             console.error("Error fetching all runs:", error);
             toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch sales runs for manager view.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        const userStr = localStorage.getItem('loggedInUser');
        if (userStr) {
            const parsedUser = JSON.parse(userStr);
            setUser(parsedUser);
            const managerRoles = ['Manager', 'Developer', 'Supervisor', 'Accountant'];
            if(managerRoles.includes(parsedUser.role)) {
                fetchAllRunsForManager();
            } else {
                setIsLoading(false); // Not a manager, no need to load all runs
            }
        } else {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user.' });
             setIsLoading(false);
        }
    }, [fetchAllRunsForManager, toast]);


    if(isLoading || !user) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    const managerRoles = ['Manager', 'Developer', 'Supervisor', 'Accountant'];
    if(managerRoles.includes(user.role)) {
        return <ManagerView allRuns={allRuns} isLoading={isLoading} user={user} />;
    }
    
    return <DriverView user={user} />;
}
