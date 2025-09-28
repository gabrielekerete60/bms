
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  Box,
  CreditCard,
  DollarSign,
  FileText,
  Hourglass,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Trash2,
  Users,
  AlertTriangle,
  ClipboardList,
  Wrench,
  Package,
  Carrot,
  Archive,
  Calendar as CalendarIcon,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RevenueChart } from '@/components/revenue-chart';
import { checkForMissingIndexes, getDashboardStats, getStaffDashboardStats, getBakerDashboardStats, getShowroomDashboardStats } from '../actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { startOfMonth, format, eachDayOfInterval, subDays, startOfDay, endOfDay, endOfYear as dateFnsEndOfYear, startOfYear as dateFnsStartOfYear } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';


type User = {
  name: string;
  role: string;
  staff_id: string;
};

type DashboardStats = {
    revenue: number;
    customers: number;
    sales: number;
    activeOrders: number;
    weeklyRevenue: { day: string, revenue: number }[];
};

type StaffDashboardStats = {
    personalStockCount: number;
    pendingTransfersCount: number;
    monthlyWasteReports: number;
};

type BakerDashboardStats = {
    activeBatches: number;
    producedThisWeek: number;
    weeklyProduction: { day: string, quantity: number }[];
};

type StorekeeperDashboardStats = {
    totalProductUnits: number;
    pendingBatchApprovals: number;
    totalInventoryValue: number;
    lowStockIngredients: number;
    productCategories: number;
    mostAvailableIngredients: { name: string, stock: number, unit: string }[];
};

type ShowroomDashboardStats = {
    dailySales: number;
    topProduct: { name: string; quantity: number } | null;
    topProductsChart: { name: string; total: number }[];
};

function IndexWarning({ indexes }: { indexes: string[] }) {
    if (indexes.length === 0) return null;

    return (
        <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Action Required: Database Configuration Needed</AlertTitle>
            <AlertDescription>
                <p className="mb-2">
                Your application requires one or more database indexes to function correctly. Without them, some pages or features may not load data.
                </p>
                <p>Please click the link(s) below to create the necessary indexes in your Firebase console:</p>
                <ul className="list-disc pl-5 space-y-2 mt-2">
                    {indexes.map((url, index) => (
                        <li key={index}>
                             <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-destructive-foreground">
                                Create Required Index #{index + 1}
                            </a>
                        </li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    )
}

function ManagementDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [missingIndexes, setMissingIndexes] = useState<string[]>([]);
  const [revenueFilter, setRevenueFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  const fetchDashboardData = useCallback(async (filter: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setIsLoading(true);
    try {
        const [indexData, dashboardStats] = await Promise.all([
            checkForMissingIndexes(),
            getDashboardStats(filter)
        ]);
        setMissingIndexes(indexData.requiredIndexes);
        setStats(dashboardStats);
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    } finally {
        setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchDashboardData(revenueFilter);
  }, [revenueFilter, fetchDashboardData]);

  const handleFilterChange = (filter: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setRevenueFilter(filter);
  };
  
  if (isLoading || !stats) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IndexWarning indexes={missingIndexes} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium capitalize">Revenue ({revenueFilter})</CardTitle>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4 text-muted-foreground"/></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => handleFilterChange('daily')}>Today</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleFilterChange('weekly')}>This Week</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleFilterChange('monthly')}>This Month</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleFilterChange('yearly')}>This Year</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{stats.revenue?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers ({revenueFilter})</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats.customers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales ({revenueFilter})</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats.sales || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeOrders || 0}</div>
          </CardContent>
        </Card>
      </div>
       <Card>
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Revenue Chart</CardTitle>
              <CardDescription>Revenue performance for this week.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RevenueChart data={stats.weeklyRevenue} />
          </CardContent>
        </Card>
    </div>
  );
}

function StaffDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState<StaffDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user.staff_id) return;
    
    // Use onSnapshot for real-time updates
    const qPending = query(collection(db, "transfers"), where('to_staff_id', '==', user.staff_id), where('status', '==', 'pending'));
    const unsubPending = onSnapshot(qPending, (snapshot) => {
        setStats(prev => ({...prev!, pendingTransfersCount: snapshot.size}));
    });

    const qWaste = query(collection(db, 'waste_logs'), where('staffId', '==', user.staff_id), where('date', '>=', Timestamp.fromDate(startOfMonth(new Date()))));
    const unsubWaste = onSnapshot(qWaste, (snapshot) => {
         setStats(prev => ({...prev!, monthlyWasteReports: snapshot.size}));
    });
    
    const qStock = collection(db, 'staff', user.staff_id, 'personal_stock');
    const unsubStock = onSnapshot(qStock, (snapshot) => {
        const stockCount = snapshot.docs.reduce((sum, doc) => sum + (doc.data().stock || 0), 0);
        setStats(prev => ({...prev!, personalStockCount: stockCount}));
        if(isLoading) setIsLoading(false);
    });

    return () => {
      unsubPending();
      unsubWaste();
      unsubStock();
    };

  }, [user.staff_id, isLoading]);
  
  if (isLoading || !stats) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold font-headline">Welcome back, {user.name.split(' ')[0]}!</h1>
      <p className="text-muted-foreground">Here is a summary of your activities.</p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
        <Link href="/dashboard/inventory/stock-control">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Stock</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.personalStockCount || 0}</div>
              <p className="text-xs text-muted-foreground">Remaining unsold product units.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/inventory/stock-control">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
              <Hourglass className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingTransfersCount || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting your acknowledgment.</p>
            </CardContent>
          </Card>
        </Link>
         <Link href="/dashboard/inventory/stock-control">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waste Reports (Monthly)</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.monthlyWasteReports || 0}</div>
              <p className="text-xs text-muted-foreground">Items you've reported as waste this month.</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="mt-6">
        <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get to your most important tasks quickly.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/dashboard/inventory/stock-control" passHref>
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                    <PackageCheck className="h-6 w-6" />
                    <span>Acknowledge Stock</span>
                </Button>
            </Link>
             <Link href="/dashboard/inventory/stock-control" passHref>
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                    <Trash2 className="h-6 w-6" />
                    <span>Report Waste</span>
                </Button>
            </Link>
             <Link href="/dashboard/communication" passHref>
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                    <FileText className="h-6 w-6" />
                    <span>Submit Report</span>
                </Button>
            </Link>
        </CardContent>
      </Card>
    </>
  );
}

const chartConfig = {
  total: {
    label: "Sales (₦)",
    color: "hsl(var(--chart-1))",
  },
  stock: {
    label: "Stock",
    color: "hsl(var(--chart-1))",
  },
};

function BakerDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState<BakerDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    const fetchBakerData = async () => {
        setIsLoading(true);
        const data = await getBakerDashboardStats();
        setStats(data);
        setIsLoading(false);
    }
    fetchBakerData();
  }, [])
  
  if (isLoading || !stats) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
     <>
      <h1 className="text-3xl font-bold font-headline">Welcome back, {user.name.split(' ')[0]}!</h1>
      <p className="text-muted-foreground">Here's your production summary.</p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Production Batches</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeBatches}</div>
            <p className="text-xs text-muted-foreground">Includes pending and in-production.</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produced This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.producedThisWeek}</div>
            <p className="text-xs text-muted-foreground">Total items successfully produced.</p>
          </CardContent>
        </Card>
      </div>

       <Card className="mt-6">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Production Chart (This Week)</CardTitle>
              <CardDescription>Quantity of items you've baked this period.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{quantity: {label: "Quantity", color: "hsl(var(--chart-1))"}}} className="h-[250px] w-full">
                <BarChart data={stats.weeklyProduction}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} />
                </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
    </>
  )
}

function StorekeeperDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState<StorekeeperDashboardStats>({
    totalProductUnits: 0,
    pendingBatchApprovals: 0,
    totalInventoryValue: 0,
    lowStockIngredients: 0,
    productCategories: 0,
    mostAvailableIngredients: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const productsQuery = collection(db, 'products');
    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      const totalUnits = snapshot.docs.reduce((sum, doc) => sum + (doc.data().stock || 0), 0);
      const categories = new Set(snapshot.docs.map(doc => doc.data().category));
      setStats(prev => ({ ...prev, totalProductUnits: totalUnits, productCategories: categories.size }));
      if (isLoading) setIsLoading(false);
    });

    const ingredientsQuery = collection(db, 'ingredients');
    const unsubIngredients = onSnapshot(ingredientsQuery, (snapshot) => {
        let lowStockCount = 0;
        const ingredientsList = snapshot.docs.map(doc => doc.data());

        ingredientsList.forEach(data => {
            const stock = data.stock || 0;
            const threshold = data.lowStockThreshold || 10;
            if (stock > 0 && stock <= threshold) {
                lowStockCount++;
            }
        });

        const mostAvailable = ingredientsList
            .sort((a,b) => (b.stock || 0) - (a.stock || 0))
            .slice(0, 5)
            .map(ing => ({ name: ing.name, stock: ing.stock || 0, unit: ing.unit || '' }));

        setStats(prev => ({ ...prev, lowStockIngredients: lowStockCount, mostAvailableIngredients: mostAvailable }));
    });

    const pendingBatchesQuery = query(collection(db, 'production_batches'), where('status', '==', 'pending_approval'));
    const unsubBatches = onSnapshot(pendingBatchesQuery, (snapshot) => {
      setStats(prev => ({ ...prev, pendingBatchApprovals: snapshot.size }));
      if (isLoading) setIsLoading(false);
    });

    return () => {
      unsubProducts();
      unsubIngredients();
      unsubBatches();
    };
  }, [isLoading]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }

  return (
    <>
      <h1 className="text-3xl font-bold font-headline">Welcome back, {user.name.split(' ')[0]}!</h1>
      <p className="text-muted-foreground">Here is your store summary.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Product Units</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProductUnits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Finished goods in stock.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Product Categories</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.productCategories}</div>
            <p className="text-xs text-muted-foreground">Number of unique categories.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Ingredients</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lowStockIngredients}</div>
            <p className="text-xs text-muted-foreground">Items at or below threshold.</p>
          </CardContent>
        </Card>
        <Link href="/dashboard/inventory/stock-control">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                <Hourglass className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingBatchApprovals}</div>
                <p className="text-xs text-muted-foreground">Awaiting your approval.</p>
              </CardContent>
            </Card>
        </Link>
      </div>

       <Card className="mt-6">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Most Available Ingredients by Quantity</CardTitle>
              <CardDescription>Top 5 most abundant ingredients in your inventory.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={stats.mostAvailableIngredients} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid horizontal={false} />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={80} />
                <XAxis dataKey="stock" type="number" hide />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent 
                        indicator="dot" 
                        formatter={(value, name, props) => `${value.toLocaleString()} ${props.payload.unit}`}
                    />}
                />
                <Bar dataKey="stock" fill="var(--color-stock)" radius={4} />
                </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
    </>
  );
}


function ShowroomStaffDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState<ShowroomDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.staff_id) {
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    
    const q = query(
        collection(db, 'orders'),
        where('staffId', '==', user.staff_id),
        where('date', '>=', Timestamp.fromDate(todayStart)),
        where('date', '<=', Timestamp.fromDate(todayEnd))
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        
        let totalSales = 0;
        const productCounts: { [productId: string]: { name: string; quantity: number, total: number } } = {};

        snapshot.forEach(doc => {
            const order = doc.data();
            totalSales += order.total || 0;
            if (Array.isArray(order.items)) {
                order.items.forEach((item: any) => {
                    if (item.productId && item.name && typeof item.quantity === 'number') {
                        if (!productCounts[item.productId]) {
                            productCounts[item.productId] = { name: item.name, quantity: 0, total: 0 };
                        }
                        productCounts[item.productId].quantity += item.quantity;
                        productCounts[item.productId].total += (item.price * item.quantity);
                    }
                });
            }
        });
        
        let topProduct: { name: string; quantity: number } | null = null;
        if (Object.keys(productCounts).length > 0) {
            topProduct = Object.values(productCounts).reduce((max, product) => max.quantity > product.quantity ? max : product);
        }

        const topProductsChart = Object.values(productCounts)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
        
        setStats({
            dailySales: totalSales,
            topProduct,
            topProductsChart,
        });
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching showroom stats:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);
  
  if (isLoading || !stats) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold font-headline">Welcome back, {user.name.split(' ')[0]}!</h1>
      <p className="text-muted-foreground">Here is your sales summary for today.</p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{stats.dailySales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From all completed orders today.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Selling Product</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.topProduct?.name || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
                {stats.topProduct ? `${stats.topProduct.quantity} units sold today` : 'No sales recorded yet.'}
            </p>
          </CardContent>
        </Card>
        <Link href="/dashboard/pos" className="flex items-center justify-center">
            <Button className="w-full h-full text-lg">
                <ShoppingBag className="mr-2 h-6 w-6"/>
                Go to POS
            </Button>
        </Link>
      </div>

       <Card className="mt-6">
          <CardHeader>
            <CardTitle>Today's Top 5 Products</CardTitle>
            <CardDescription>A breakdown of the best-selling products today by revenue.</CardDescription>
          </CardHeader>
          <CardContent>
             {stats.topProductsChart.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={stats.topProductsChart} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <CartesianGrid horizontal={false} />
                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={80} />
                        <XAxis dataKey="total" type="number" hide />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" formatter={(value) => `₦${value.toLocaleString()}`} />}
                        />
                        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                    </BarChart>
                </ChartContainer>
            ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No sales data available for today.
                </div>
            )}
          </CardContent>
        </Card>
    </>
  );
}


export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  if (isLoading || !user) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  const managementRoles = ['Manager', 'Supervisor', 'Accountant', 'Developer'];

  if (user.role === 'Baker') {
      return <BakerDashboard user={user} />;
  }
  
  if(user.role === 'Storekeeper') {
      return <StorekeeperDashboard user={user} />;
  }

  if (managementRoles.includes(user.role)) {
      return <ManagementDashboard />;
  }

  if (user.role === 'Showroom Staff') {
      return <ShowroomStaffDashboard user={user} />;
  }

  return <StaffDashboard user={user} />;
}
