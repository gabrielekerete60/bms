
"use client";

import React, { useState, useMemo, useEffect, useRef, Suspense, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Printer, FileDown, MoreHorizontal, Calendar as CalendarIcon, ListFilter, Search, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { DateRange } from "react-day-picker";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { collection, getDocs, query, orderBy, Timestamp, doc, getDoc, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStaffList } from "@/app/actions";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type CompletedOrder = {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  date: Timestamp;
  paymentMethod: 'POS' | 'Cash' | 'Paystack' | 'Credit';
  customerName?: string;
  staffId?: string;
  staffName?: string;
  status: 'Completed' | 'Pending' | 'Cancelled';
}

type User = {
    name: string;
    role: string;
    staff_id: string;
};

type StaffMember = {
    id: string;
    name: string;
    role: string;
}

const formatCurrency = (amount?: number) => `₦${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


const Receipt = React.forwardRef<HTMLDivElement, { order: CompletedOrder, storeAddress?: string }>(({ order, storeAddress }, ref) => {
  return (
    <div ref={ref} className="print:p-8">
      <div className="text-center mb-4">
          <h2 className="font-headline text-2xl text-center">BMS</h2>
          <p className="text-center text-sm">Sale Receipt</p>
          {storeAddress && <p className="text-center text-xs text-muted-foreground">{storeAddress}</p>}
        </div>
        <div className="py-2 space-y-2">
            <div className="text-xs text-muted-foreground">
                <p><strong>Order ID:</strong> {order.id}</p>
                <p><strong>Date:</strong> {order.date.toDate().toLocaleString()}</p>
                <p><strong>Payment Method:</strong> {order.paymentMethod}</p>
                <p><strong>Customer:</strong> {order.customerName || 'Walk-in'}</p>
            </div>
            <Separator className="my-2"/>
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="text-xs h-auto p-1">Item</TableHead>
                    <TableHead className="text-center text-xs h-auto p-1">Qty</TableHead>
                    <TableHead className="text-right text-xs h-auto p-1">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {order.items.map((item, index) => (
                    <TableRow key={item.id || index}>
                        <TableCell className="text-xs p-1">{item.name}</TableCell>
                        <TableCell className="text-center text-xs p-1">{item.quantity}</TableCell>
                        <TableCell className="text-right text-xs p-1">₦{(item.price * item.quantity).toFixed(2)}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
                <Separator className="my-2"/>
                <div className="w-full space-y-1 text-sm pr-1">
                <div className="flex justify-between font-bold text-base mt-1">
                    <span>Total</span>
                    <span>₦{order.total.toFixed(2)}</span>
                </div>
            </div>
            <Separator className="my-2"/>
            <p className="text-center text-xs text-muted-foreground">Thank you for your patronage!</p>
        </div>
    </div>
  );
});
Receipt.displayName = 'Receipt';

const handlePrint = (node: HTMLElement | null) => {
    if (!node) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const printableContent = `
            <html>
                <head>
                    <title>Receipt</title>
                    <style>
                        body { font-family: sans-serif; margin: 20px; }
                        .receipt-container { max-width: 300px; margin: auto; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .text-lg { font-size: 1.125rem; }
                        .text-2xl { font-size: 1.5rem; }
                        .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
                        .text-sm { font-size: 0.875rem; }
                        .text-xs { font-size: 0.75rem; }
                        .text-muted-foreground { color: #6b7280; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 4px 0; }
                        .text-right { text-align: right; }
                        .flex { display: flex; }
                        .justify-between { justify-content: space-between; }
                        hr { border: 0; border-top: 1px dashed #d1d5db; margin: 1rem 0; }
                    </style>
                </head>
                <body>
                    <div class="receipt-container">
                        ${node.innerHTML}
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.onafterprint = function() {
                                window.close();
                            };
                        };
                    </script>
                </body>
            </html>
        `;
        printWindow.document.write(printableContent);
        printWindow.document.close();
    }
};

const getStatusVariant = (status?: string) => {
    if (!status) return 'outline';
    switch (status.toLowerCase()) {
        case 'completed':
            return 'default';
        case 'pending':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function PaginationControls({
    visibleRows,
    setVisibleRows,
    totalRows
}: {
    visibleRows: number | 'all',
    setVisibleRows: (val: number | 'all') => void,
    totalRows: number
}) {
    const [inputValue, setInputValue] = useState<string>('');

    const handleApply = () => {
        const num = parseInt(inputValue, 10);
        if (!isNaN(num) && num > 0) {
            setVisibleRows(num);
        }
    };
    
    return (
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <span>Show:</span>
            <Button variant={visibleRows === 10 ? "default" : "outline"} size="sm" onClick={() => setVisibleRows(10)}>10</Button>
            <Button variant={visibleRows === 20 ? "default" : "outline"} size="sm" onClick={() => setVisibleRows(20)}>20</Button>
            <Button variant={visibleRows === 50 ? "default" : "outline"} size="sm" onClick={() => setVisibleRows(50)}>50</Button>
            <Button variant={visibleRows === 'all' ? "default" : "outline"} size="sm" onClick={() => setVisibleRows('all')}>All ({totalRows})</Button>
            <div className="flex items-center gap-1">
                <Input 
                    type="number" 
                    className="h-8 w-16" 
                    placeholder="Custom"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                />
                <Button size="sm" onClick={handleApply}>Apply</Button>
            </div>
        </div>
    )
}

function OrdersTable({ orders, onSelectOne, onSelectAll, selectedOrders, allOrdersSelected, storeAddress, grandTotal, user }: { orders: CompletedOrder[], onSelectOne: (id: string, checked: boolean) => void, onSelectAll: (checked: boolean) => void, selectedOrders: string[], allOrdersSelected: boolean, storeAddress?: string, grandTotal: number, user: User | null }) {
    const [viewingOrder, setViewingOrder] = useState<CompletedOrder | null>(null);
    const [printingOrder, setPrintingOrder] = useState<CompletedOrder | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    const onPrint = (order: CompletedOrder) => {
      setPrintingOrder(order);
      setTimeout(() => {
        handlePrint(receiptRef.current);
        setPrintingOrder(null);
      }, 100);
    }
    
    const isShowroomStaff = user?.role === 'Showroom Staff';

    return (
        <>
        <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Order Details</DialogTitle>
                    <DialogDescription>A summary of the selected order.</DialogDescription>
                </DialogHeader>
                {viewingOrder && <Receipt order={viewingOrder} storeAddress={storeAddress} />}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setViewingOrder(null)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <div className="hidden">
            {printingOrder && <Receipt order={printingOrder} ref={receiptRef} storeAddress={storeAddress}/>}
        </div>
        <div className="overflow-x-auto">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableCell>
                       <Checkbox
                            checked={allOrdersSelected}
                            onCheckedChange={(checked) => onSelectAll(checked as boolean)}
                            aria-label="Select all"
                        />
                    </TableCell>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    {!isShowroomStaff && <TableHead>Staff</TableHead>}
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {orders.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={10} className="h-24 text-center">
                            No orders found for this view.
                        </TableCell>
                    </TableRow>
                ) : (
                    orders.map((order) => (
                        <TableRow 
                            key={order.id} 
                            data-state={selectedOrders.includes(order.id) ? "selected" : undefined}
                            onClick={() => setViewingOrder(order)}
                            className="cursor-pointer"
                        >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={selectedOrders.includes(order.id)}
                                    onCheckedChange={(checked) => onSelectOne(order.id, checked as boolean)}
                                    aria-label={`Select order ${order.id}`}
                                />
                            </TableCell>
                            <TableCell className="font-medium">{order.id.substring(0, 7)}...</TableCell>
                            <TableCell>{order.date.toDate().toLocaleDateString()}</TableCell>
                            <TableCell>{order.customerName || 'Walk-in'}</TableCell>
                            {!isShowroomStaff && <TableCell>{order.staffName || 'N/A'}</TableCell>}
                            <TableCell>{order.items.reduce((acc, item) => acc + item.quantity, 0)}</TableCell>
                            <TableCell>
                                <Badge variant={'secondary'}>
                                    {order.paymentMethod}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={getStatusVariant(order.status)}>
                                    {order.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">₦{order.total.toFixed(2)}</TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Open menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => setViewingOrder(order)}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            <span>View Details</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => onPrint(order)}>
                                            <Printer className="mr-2 h-4 w-4" />
                                            <span>Print Receipt</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={isShowroomStaff ? 7 : 8} className="text-right font-bold">Grand Total</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(grandTotal)}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
            </TableFooter>
        </Table>
        </div>
        </>
    );
}


function ExportDialog({ children, onExport }: { children: React.ReactNode, onExport: (options: { dateRange?: DateRange, status: string }) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>();
  const [status, setStatus] = useState("all");

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Orders</DialogTitle>
          <DialogDescription>
            Select a date range and status to export a filtered list of orders to a CSV file.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="grid gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
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
                        <span>Filter by date range</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                    />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="grid gap-2">
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={() => { onExport({ dateRange: date, status }); setIsOpen(false); }}>Export to CSV</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RegularOrdersPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [allOrders, setAllOrders] = useState<CompletedOrder[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [date, setDate] = useState<DateRange | undefined>();
  const [tempDate, setTempDate] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [storeAddress, setStoreAddress] = useState<string | undefined>();
  const [visibleRows, setVisibleRows] = useState<number | 'all'>(10);

  const selectedOrdersRef = useRef<HTMLDivElement>(null);
  const [ordersToPrint, setOrdersToPrint] = useState<CompletedOrder[]>([]);

  useEffect(() => {
    if (ordersToPrint.length > 0 && selectedOrdersRef.current) {
        handlePrint(selectedOrdersRef.current);
        setOrdersToPrint([]);
    }
  }, [ordersToPrint]);

  const handlePrintSelected = () => {
    const selected = allOrders.filter(order => selectedOrders.includes(order.id));
    setOrdersToPrint(selected);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
        try {
            const userStr = localStorage.getItem('loggedInUser');
            const currentUser: User | null = userStr ? JSON.parse(userStr) : null;
            setUser(currentUser);
            
            let initialStaffFilter = 'all';
            if(currentUser?.role === 'Showroom Staff') {
                const today = new Date();
                setDate({ from: startOfDay(today), to: endOfDay(today) });
                initialStaffFilter = currentUser.staff_id;
            }
             setStaffFilter(initialStaffFilter);

            const [settingsDoc, staffListData] = await Promise.all([
                getDoc(doc(db, 'settings', 'app_config')),
                getStaffList()
            ]);

            if (settingsDoc.exists()) {
                setStoreAddress(settingsDoc.data().storeAddress);
            }
            setStaffList(staffListData as StaffMember[]);

            const ordersQuery = query(collection(db, "orders"), orderBy("date", "desc"));
            const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
                const staffMap = new Map(staffListData.map(s => [s.id, s.name]));
                const ordersList = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        staffName: staffMap.get(data.staffId) || data.staffName || 'N/A' 
                    } as CompletedOrder;
                });
                setAllOrders(ordersList);
                if (isLoading) setIsLoading(false);
            }, (error) => {
                console.error("Error fetching orders:", error);
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "Could not fetch orders from the database.",
                });
                if (isLoading) setIsLoading(false);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Initialization failed:", error);
            setIsLoading(false);
        }
    };
    
    const unsubscribePromise = fetchInitialData();

    return () => {
        unsubscribePromise.then(unsub => {
            if (unsub) unsub();
        });
    };
  }, [toast, isLoading]);

  const isShowroomStaff = user?.role === 'Showroom Staff';

  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      const orderDate = order.date.toDate();
      
      let staffMatch = true;
      if (isShowroomStaff) {
          staffMatch = order.staffId === user?.staff_id;
      } else {
          staffMatch = staffFilter === 'all' || order.staffId === staffFilter;
      }

      const dateMatch = !date?.from || (orderDate >= date.from && (!date.to || orderDate <= date.to));
      const searchMatch = !searchTerm || order.id.toLowerCase().includes(searchTerm.toLowerCase()) || order.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
      const paymentMatch = paymentMethodFilter === 'all' || order.paymentMethod === paymentMethodFilter;
      
      return dateMatch && searchMatch && paymentMatch && staffMatch;
    });
  }, [allOrders, date, searchTerm, paymentMethodFilter, staffFilter, isShowroomStaff, user]);
  
  const grandTotal = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + order.total, 0);
  }, [filteredOrders]);

  const paginatedOrders = useMemo(() => {
    return visibleRows === 'all' ? filteredOrders : filteredOrders.slice(0, visibleRows);
  }, [filteredOrders, visibleRows]);

  const handleSelectOne = (orderId: string, checked: boolean) => {
    setSelectedOrders(prev => {
        if (checked) {
            return [...prev, orderId];
        } else {
            return prev.filter(id => id !== orderId);
        }
    });
  }
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(paginatedOrders.map(o => o.id));
    } else {
      setSelectedOrders([]);
    }
  }
  
  const handleDateApply = () => {
    setDate(tempDate);
    setIsDatePopoverOpen(false);
  }

  const handleExport = (options: { dateRange?: DateRange, status: string }) => {
    let ordersToExport = allOrders;
    
    if (options.dateRange?.from) {
        ordersToExport = ordersToExport.filter(order => {
            const orderDate = order.date.toDate();
            return orderDate >= options.dateRange!.from! && (!options.dateRange!.to || orderDate <= options.dateRange!.to!);
        });
    }

    if (options.status !== 'all') {
        ordersToExport = ordersToExport.filter(order => order.status === options.status);
    }

    const headers = ["Order ID", "Date", "Customer", "Status", "Payment Method", "Total"];
    const rows = ordersToExport.map(o => 
        [o.id, o.date.toDate().toLocaleString(), o.customerName || 'Walk-in', o.status, o.paymentMethod, o.total].join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Success", description: `${ordersToExport.length} orders exported.` });
  };
  
  const salesStaff = useMemo(() => {
    return staffList.filter(s => s.role === 'Showroom Staff' || s.role === 'Delivery Staff');
  }, [staffList]);


  const ordersByStatus = (status: CompletedOrder['status']) => paginatedOrders.filter(o => o.status === status);
  const TABS = ['All Orders', 'Completed', 'Pending', 'Cancelled'];

  const renderContent = (orders: CompletedOrder[]) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <OrdersTable 
        orders={orders} 
        onSelectOne={handleSelectOne}
        onSelectAll={handleSelectAll}
        selectedOrders={selectedOrders}
        allOrdersSelected={selectedOrders.length > 0 && selectedOrders.length === paginatedOrders.length}
        storeAddress={storeAddress}
        grandTotal={grandTotal}
        user={user}
      />
    );
  };
  
  return (
    <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold font-headline">Regular Orders</h1>
        <Tabs defaultValue="All Orders">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <TabsList>
                    {TABS.map(tab => <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>)}
                </TabsList>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" disabled={selectedOrders.length === 0} onClick={handlePrintSelected}><Printer className="mr-2"/> Print Selected</Button>
                     {!isShowroomStaff && (
                         <ExportDialog onExport={handleExport}>
                            <Button variant="outline"><FileDown className="mr-2"/> Export</Button>
                        </ExportDialog>
                     )}
                </div>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-start gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input placeholder="Search by Order ID or customer..." className="pl-10 w-full sm:w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        {!isShowroomStaff && (
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
                                <span>Filter by date range</span>
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
                        )}
                         <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filter by payment" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Payments</SelectItem>
                                <SelectItem value="Cash">Cash</SelectItem>
                                <SelectItem value="POS">POS</SelectItem>
                                <SelectItem value="Paystack">Transfer</SelectItem>
                                {!isShowroomStaff && <SelectItem value="Credit">Credit</SelectItem>}
                            </SelectContent>
                        </Select>
                        {!isShowroomStaff && (
                        <Select value={staffFilter} onValueChange={setStaffFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filter by staff" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Staff</SelectItem>
                                {salesStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <TabsContent value="All Orders">
                      {renderContent(paginatedOrders)}
                    </TabsContent>
                    <TabsContent value="Completed">
                      {renderContent(ordersByStatus('Completed'))}
                    </TabsContent>
                    <TabsContent value="Pending">
                      {renderContent(ordersByStatus('Pending'))}
                    </TabsContent>
                    <TabsContent value="Cancelled">
                      {renderContent(ordersByStatus('Cancelled'))}
                    </TabsContent>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                        Showing <strong>{paginatedOrders.length}</strong> of <strong>{filteredOrders.length}</strong> orders.
                    </div>
                    <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={filteredOrders.length} />
                </CardFooter>
            </Card>
        </Tabs>
        <div className="hidden">
           <div ref={selectedOrdersRef} className="p-8">
                <h1 className="text-2xl font-bold mb-4">Selected Orders</h1>
                {ordersToPrint.map(order => (
                    <div key={order.id} className="mb-8 p-4 border rounded-lg page-break-before:always">
                        <Receipt order={order} storeAddress={storeAddress} />
                    </div>
                ))}
            </div>
        </div>
    </div>
  )
}

function RegularOrdersPageWithSuspense() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-16 w-16 animate-spin" /></div>}>
            <RegularOrdersPage />
        </Suspense>
    )
}

export default function RegularOrdersPageWithTypes() {
  return <RegularOrdersPageWithSuspense />;
}
