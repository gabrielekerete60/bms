
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Loader2, DollarSign, Receipt, TrendingDown, TrendingUp, PenSquare, RefreshCcw, HandCoins, Search, Calendar as CalendarIcon, ArrowRight, MoreVertical, AlertTriangle, MessageSquareQuote, CheckCircle, PackageSearch, Banknote, PlusCircle, Trash2, Settings2, Eye, FileDigit, CornerDownRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear as dateFnsEndOfYear } from 'date-fns';
import { getFinancialSummary, getDebtRecords, getDirectCosts, getIndirectCosts, getClosingStocks, getWages, addDirectCost, addIndirectCost, getSales, getDrinkSalesSummary, PaymentConfirmation, getPaymentConfirmations, getCreditors, getDebtors, Creditor, Debtor, handleLogPayment, getWasteLogs, WasteLog, getDiscountRecords, getProfitAndLossStatement, ProfitAndLossStatement, getAccountSummary, SupplyRequest, getPendingSupplyRequests, approveStockIncrease, declineStockIncrease, handlePaymentConfirmation } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Separator } from '@/components/ui/separator';
import { collection, onSnapshot, query, where, orderBy, Timestamp, addDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


// --- Helper Functions & Type Definitions ---
const formatCurrency = (amount?: number) => `₦${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type CostCategory = { id: string; name: string; type: 'direct' | 'indirect' };
type AccountSummary = Record<string, number>;
type DebtRecord = { id: string; date: string; description: string; debit: number; credit: number; };
type DirectCost = { id: string; date: string; description: string; category: string; quantity: number; total: number; details?: { name: string, amount: number }[] };
type IndirectCost = { id: string; date: string; description: string; category: string; amount: number; details?: { name: string, amount: number }[] };
type ClosingStock = { name: string; value: number; quantity: number; unit: string; };
type DiscountRecord = { id: string; bread_type: string; amount: number };
type Wage = { id: string; staffName: string; month: string; date: string; netPay: number; basePay: number; additions: number; deductions: { shortages: number; advanceSalary: number; debt: number; fine: number; }; role: string; };
type Sale = { id: string; date: any; description: string; cash: number; transfer: number; pos: number; creditSales: number; shortage: number; total: number; staffName?: string; };
type DrinkSaleSummary = { productId: string; productName: string; quantitySold: number; totalRevenue: number; costPrice: number, stock: number };

const chartConfig = {
  amount: {
    label: "Amount (₦)",
    color: "hsl(var(--primary))",
  },
   total: {
    label: "Total (₦)",
    color: "hsl(var(--primary))",
  },
};

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
                    className="h-8 w-20" 
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

function ExpenseDetailDialog({ cost, onOpenChange, isOpen }: { cost: DirectCost | IndirectCost | null, onOpenChange: (open: boolean) => void, isOpen: boolean }) {
    if (!cost) return null;
    const isDirect = 'total' in cost;
    const amount = isDirect ? cost.total : cost.amount;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Expense Details</DialogTitle>
                    <DialogDescription>
                        {cost.description} on {format(new Date(cost.date), 'PPP')}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Category</span>
                        <Badge variant="outline">{cost.category}</Badge>
                    </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Amount</span>
                        <span className="font-semibold">{formatCurrency(amount)}</span>
                    </div>

                    {cost.details && cost.details.length > 0 && (
                        <>
                            <Separator />
                            <h4 className="font-medium">Breakdown</h4>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Staff Name</TableHead>
                                        <TableHead className="text-right">Amount Paid</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cost.details.map((detail, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{detail.name}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(detail.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// --- DIALOGS FOR ADDING DATA ---
function ManageCategoriesDialog({ categories, onAdd, onDelete, disabled }: { categories: CostCategory[], onAdd: (name: string, type: 'direct' | 'indirect') => void, onDelete: (id: string) => void, disabled?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryType, setNewCategoryType] = useState<'direct' | 'indirect'>('indirect');
    
    const directCategories = categories.filter(c => c.type === 'direct');
    const indirectCategories = categories.filter(c => c.type === 'indirect');

    const handleAdd = () => {
        if (newCategoryName.trim()) {
            onAdd(newCategoryName, newCategoryType);
            setNewCategoryName('');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={disabled}><Settings2 className="mr-2 h-4 w-4" /> Manage Categories</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manage Cost Categories</DialogTitle>
                    <DialogDescription>Add or remove categories for your expense logs.</DialogDescription>
                </DialogHeader>
                <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                    {/* New Category Form */}
                    <div className="md:col-span-2 space-y-2 p-4 border rounded-md">
                        <h4 className="font-medium">Add New Category</h4>
                        <div className="flex gap-2">
                             <Input 
                                placeholder="e.g., Utilities" 
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                            />
                            <Select value={newCategoryType} onValueChange={(val: any) => setNewCategoryType(val)}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="indirect">Indirect</SelectItem>
                                    <SelectItem value="direct">Direct</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleAdd} size="icon"><PlusCircle className="h-4 w-4"/></Button>
                        </div>
                    </div>
                     {/* Category Lists */}
                    <div className="space-y-2">
                        <h4 className="font-medium">Indirect Categories</h4>
                         <div className="space-y-2">
                            {indirectCategories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                    <span>{cat.name}</span>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(cat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="space-y-2">
                        <h4 className="font-medium">Direct Categories</h4>
                         <div className="space-y-2">
                            {directCategories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                    <span>{cat.name}</span>
                                     <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(cat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                 <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Done</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AddDirectCostDialog({ onCostAdded, categories, disabled }: { onCostAdded: () => void, categories: CostCategory[], disabled?: boolean }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [quantity, setQuantity] = useState<number | string>('');
    const [total, setTotal] = useState<number | string>('');

    const handleSubmit = async () => {
        if (!description || !category || !quantity || !total) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill all fields.' });
            return;
        }
        setIsLoading(true);
        const result = await addDirectCost({ description, category, quantity: Number(quantity), total: Number(total) });
        if (result.success) {
            toast({ title: 'Success', description: 'Direct cost added.' });
            onCostAdded();
            setIsOpen(false);
            setDescription(''); setCategory(''); setQuantity(''); setTotal('');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm" disabled={disabled}><PenSquare className="mr-2 h-4 w-4" /> Add Direct Cost</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Direct Cost</DialogTitle>
                    <DialogDescription>Record a cost directly related to production, like raw materials.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Bag of Flour" /></div>
                     <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label>Quantity</Label><Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
                        <div className="grid gap-2"><Label>Total Cost (₦)</Label><Input type="number" value={total} onChange={e => setTotal(e.target.value)} /></div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Cost</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AddIndirectCostDialog({ onCostAdded, categories, disabled }: { onCostAdded: () => void, categories: CostCategory[], disabled?: boolean }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState<number | string>('');

    const handleSubmit = async () => {
        if (!description || !category || !amount) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill all fields.' });
            return;
        }
        setIsLoading(true);
        const result = await addIndirectCost({ description, category, amount: Number(amount) });
        if (result.success) {
            toast({ title: 'Success', description: 'Indirect cost added.' });
            onCostAdded();
            setIsOpen(false);
            setDescription(''); setCategory(''); setAmount('');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm" disabled={disabled}><PenSquare className="mr-2 h-4 w-4" /> Add Indirect Cost</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Indirect Cost</DialogTitle>
                    <DialogDescription>Record an operational cost not directly tied to a single product, like rent or utilities.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Diesel for Generator" /></div>
                     <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2"><Label>Amount (₦)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Cost</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function LogPaymentDialog({ creditor, onPaymentLogged, disabled }: { creditor: Creditor, onPaymentLogged: () => void, disabled?: boolean }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [amount, setAmount] = useState<number | string>('');

    const handleSubmit = async () => {
        if (!amount || Number(amount) <= 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid amount.'});
            return;
        }
        if (Number(amount) > creditor.balance) {
             toast({ variant: 'destructive', title: 'Error', description: `Payment cannot be greater than the outstanding balance of ${formatCurrency(creditor.balance)}.`});
            return;
        }
        setIsLoading(true);
        const result = await handleLogPayment(creditor.id, Number(amount));
        if (result.success) {
            toast({ title: 'Success', description: `Payment of ${formatCurrency(Number(amount))} logged.`});
            onPaymentLogged();
            setIsOpen(false);
            setAmount('');
        } else {
             toast({ variant: 'destructive', title: 'Error', description: result.error});
        }
        setIsLoading(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={disabled}><HandCoins className="h-4 w-4"/></Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Log Payment to {creditor.name}</DialogTitle>
                    <DialogDescription>
                        Outstanding Balance: <span className="font-bold text-destructive">{formatCurrency(creditor.balance)}</span>
                    </DialogDescription>
                </DialogHeader>
                 <div className="py-4">
                    <Label htmlFor="payment-amount">Amount Paid (₦)</Label>
                    <Input id="payment-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Log Payment</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function DateRangeFilter({ date, setDate, align = 'end' }: { date: DateRange | undefined, setDate: (date: DateRange | undefined) => void, align?: "start" | "center" | "end" }) {
    const [tempDate, setTempDate] = useState<DateRange | undefined>(date);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setTempDate(date);
    }, [date]);

    const handleApply = () => {
        setDate(tempDate);
        setIsOpen(false);
    }

    return (
         <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-normal",!date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? ( date.to ? (<> {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")} </>) : (format(date.from, "LLL dd, y"))) : (<span>Filter by date range</span>)}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align={align}>
                <Calendar initialFocus mode="range" defaultMonth={tempDate?.from} selected={tempDate} onSelect={setTempDate} numberOfMonths={2}/>
                <div className="p-2 border-t flex justify-end">
                    <Button onClick={handleApply}>Apply</Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}


// --- Tab Components ---

function SummaryTab() {
    const [summary, setSummary] = useState<AccountSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>();

    const fetchSummary = useCallback(async (newDate: DateRange | undefined) => {
        setIsLoading(true);
        const range = newDate?.from ? { from: startOfDay(newDate.from), to: endOfDay(newDate.to || newDate.from) } : undefined;
        const data = await getAccountSummary(range);
        setSummary(data);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchSummary(date);
    }, [date, fetchSummary]);

    const totalSummary = useMemo(() => {
        if (!summary) return 0;
        return Object.values(summary).reduce((acc, value) => acc + (value || 0), 0);
    }, [summary]);

    if (isLoading || !summary) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const summaryOrder: (keyof AccountSummary)[] = [
        'Sale', 'Purchases (Confectioneries)', 'Closing Stock', 'Expenses', 'Discount Allowed', 
        'Bad or Damages', 'Loan', 'Indirect Exp', 'Assets', 'Debtor', 'Equipment'
    ];

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Summary of Account</CardTitle>
                        <CardDescription>A top-level overview of key financial accounts.</CardDescription>
                    </div>
                     <DateRangeFilter date={date} setDate={setDate} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="md:hidden space-y-4">
                    {summaryOrder.map(key => (
                        <Card key={key} className="p-4 flex justify-between items-center">
                            <span className="font-medium">{key}</span>
                            <span className="font-bold">{formatCurrency(summary[key])}</span>
                        </Card>
                    ))}
                    <Card className="p-4 flex justify-between items-center bg-muted">
                        <span className="font-bold">Grand Total</span>
                        <span className="font-bold">{formatCurrency(totalSummary)}</span>
                    </Card>
                </div>
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="font-bold">Account</TableHead>
                                <TableHead className="text-right font-bold">Amount (₦)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaryOrder.map(key => (
                                <TableRow key={key}>
                                    <TableCell>{key}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(summary[key])}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={1} className="text-right font-bold">Grand Total</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalSummary)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function PnLRow({ label, value, isSubtotal = false, isTotal = false, isFinal = false, isHeader = false, isExpense = false }: { label: string, value?: number, isSubtotal?: boolean, isTotal?: boolean, isFinal?: boolean, isHeader?: boolean, isExpense?: boolean }) {
    if (isHeader) {
        return (
             <TableRow>
                <TableHead colSpan={2} className="font-bold text-base text-foreground">{label}</TableHead>
            </TableRow>
        )
    }
    return (
        <TableRow className={cn(
            isTotal && "border-t",
            (isTotal || isFinal) && "font-bold",
            isSubtotal && "text-muted-foreground",
        )}>
            <TableCell className={cn(isSubtotal && "pl-4", isExpense && "pl-8")}>{label}</TableCell>
            <TableCell className="text-right">{value != null ? formatCurrency(value) : ''}</TableCell>
        </TableRow>
    )
}

function FinancialsTab() {
    const [statement, setStatement] = useState<ProfitAndLossStatement | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });

    const fetchStatement = useCallback(async (newDate: DateRange | undefined) => {
        setIsLoading(true);
        const range = newDate?.from ? { from: startOfDay(newDate.from), to: endOfDay(newDate.to || newDate.from) } : undefined;
        const data = await getProfitAndLossStatement(range);
        setStatement(data);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchStatement(date);
    }, [date, fetchStatement]);

    if (isLoading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!statement) return <div>Could not load statement.</div>

    return (
         <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Trading, Profit &amp; Loss Statement</CardTitle>
                        <CardDescription>For the period ending {date?.to ? format(date.to, 'PPP') : format(new Date(), 'PPP')}</CardDescription>
                    </div>
                     <DateRangeFilter date={date} setDate={setDate} />
                </div>
            </CardHeader>
            <CardContent>
                 <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                     {/* Left Column: Revenue & Gross Profit */}
                     <Table>
                         <TableHeader>
                             <TableRow>
                                 <TableHead>Description</TableHead>
                                 <TableHead className="text-right">Amount (₦)</TableHead>
                             </TableRow>
                         </TableHeader>
                         <TableBody>
                             <PnLRow label="Sales" value={statement.sales} isHeader />
                             <PnLRow label="Sales" value={statement.sales} isSubtotal/>

                             <PnLRow label="Less: Cost of Sales" value={undefined} isHeader/>
                             <PnLRow label="Opening Stock" value={statement.openingStock} isSubtotal/>
                             <PnLRow label="Add: Purchases" value={statement.purchases} isSubtotal/>
                             <PnLRow label="Add: Carriage Inward" value={statement.carriageInward} isSubtotal/>
                             <PnLRow label="Cost of Goods available for Sale" value={statement.costOfGoodsAvailable} />
                             <PnLRow label="Less: Closing Stock" value={-statement.closingStock} />
                             <PnLRow label="Cost of Goods Sold (COGS)" value={statement.cogs} isTotal />
                             <PnLRow label="Gross Profit" value={statement.grossProfit} isTotal />
                         </TableBody>
                     </Table>
                     {/* Right Column: Expenses & Net Profit */}
                      <Table>
                           <TableHeader>
                             <TableRow>
                                 <TableHead>Description</TableHead>
                                 <TableHead className="text-right">Amount (₦)</TableHead>
                             </TableRow>
                         </TableHeader>
                        <TableBody>
                            <PnLRow label="Less: Expenses" value={undefined} isHeader/>
                            {Object.entries(statement.expenses).map(([key, value]) => (
                                <PnLRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} value={value} isExpense />
                            ))}
                            <PnLRow label="Total Expenses" value={statement.totalExpenses} isTotal/>
                            <PnLRow label="Net Profit c/d" value={statement.netProfit} isFinal />
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>
    );
}

function DebtorsCreditorsTab({ isReadOnly }: { isReadOnly?: boolean }) {
    const [creditors, setCreditors] = useState<Creditor[]>([]);
    const [debtors, setDebtors] = useState<Debtor[]>([]);
    const [debtLedger, setDebtLedger] = useState<DebtRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>();
    const [visibleLedgerRows, setVisibleLedgerRows] = useState<number | 'all'>(10);
    const [visibleCreditorRows, setVisibleCreditorRows] = useState<number | 'all'>(10);
    const [visibleDebtorRows, setVisibleDebtorRows] = useState<number | 'all'>(10);

    const fetchData = useCallback(() => {
        setIsLoading(true);
        Promise.all([getCreditors(), getDebtors(), getDebtRecords()]).then(([credData, debtData, ledgerData]) => {
            setCreditors(credData);
            setDebtors(debtData);
            setDebtLedger(ledgerData as DebtRecord[]);
        }).catch(err => {
            console.error(err);
        }).finally(() => {
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const filteredLedger = useMemo(() => {
        if (!date?.from) return debtLedger;
        const from = startOfDay(date.from);
        const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
        return debtLedger.filter(rec => {
            const recDate = new Date(rec.date);
            return recDate >= from && recDate <= to;
        });
    }, [debtLedger, date]);

    const paginatedCreditors = useMemo(() => (visibleCreditorRows === 'all' ? creditors : creditors.slice(0, visibleCreditorRows)), [creditors, visibleCreditorRows]);
    const paginatedDebtors = useMemo(() => (visibleDebtorRows === 'all' ? debtors : debtors.slice(0, visibleDebtorRows)), [debtors, visibleDebtorRows]);
    const paginatedLedger = useMemo(() => (visibleLedgerRows === 'all' ? filteredLedger : filteredLedger.slice(0, visibleLedgerRows)), [filteredLedger, visibleLedgerRows]);
    
    const { debitTotal, creditTotal } = useMemo(() => {
        const debit = filteredLedger.reduce((sum, item) => sum + (item.debit || 0), 0);
        const credit = filteredLedger.reduce((sum, item) => sum + (item.credit || 0), 0);
        return { debitTotal: debit, creditTotal: credit };
    }, [filteredLedger]);

    if (isLoading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Creditors (Money We Owe)</CardTitle>
                        <CardDescription>Suppliers to whom the business has an outstanding balance.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <div className="md:hidden space-y-4">
                        {paginatedCreditors.map(c => (
                            <Card key={c.id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{c.name}</p>
                                        <p className="text-sm text-muted-foreground">{c.contactPerson}</p>
                                    </div>
                                    <LogPaymentDialog creditor={c} onPaymentLogged={fetchData} disabled={isReadOnly} />
                                </div>
                                <div className="mt-2 pt-2 border-t">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Balance:</span>
                                        <span className="font-bold text-destructive">{formatCurrency(c.balance)}</span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {paginatedCreditors.length === 0 && <p className="text-center text-muted-foreground py-12">No outstanding creditors.</p>}
                    </div>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-center">Action</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {paginatedCreditors.length === 0 && <TableRow><TableCell colSpan={4} className="h-24 text-center">No outstanding creditors.</TableCell></TableRow>}
                                {paginatedCreditors.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell>{c.name}</TableCell>
                                        <TableCell>{c.contactPerson}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(c.balance)}</TableCell>
                                        <TableCell className="text-center"><LogPaymentDialog creditor={c} onPaymentLogged={fetchData} disabled={isReadOnly} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <PaginationControls visibleRows={visibleCreditorRows} setVisibleRows={setVisibleCreditorRows} totalRows={creditors.length} />
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Debtors (Money Owed to Us)</CardTitle>
                        <CardDescription>Customers who have an outstanding credit balance with the business.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="md:hidden space-y-4">
                            {paginatedDebtors.map(d => (
                                <Card key={d.id} className="p-4 space-y-2">
                                    <p className="font-semibold">{d.name}</p>
                                    <p className="text-sm text-muted-foreground">{d.phone}</p>
                                    <div className="text-sm pt-2 border-t">
                                        <div className="flex justify-between"><span>Owed:</span><span>{formatCurrency(d.amountOwed)}</span></div>
                                        <div className="flex justify-between"><span>Paid:</span><span className="text-green-500">{formatCurrency(d.amountPaid)}</span></div>
                                        <div className="flex justify-between font-bold"><span>Balance:</span><span>{formatCurrency(d.balance)}</span></div>
                                    </div>
                                </Card>
                            ))}
                            {paginatedDebtors.length === 0 && <p className="text-center text-muted-foreground py-12">No outstanding debtors.</p>}
                        </div>
                        <div className="hidden md:block">
                        <Table>
                            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Amount Owed</TableHead><TableHead className="text-right">Amount Paid</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {paginatedDebtors.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center">No outstanding debtors.</TableCell></TableRow>}
                                {paginatedDebtors.map(d => (
                                    <TableRow key={d.id}>
                                        <TableCell>{d.name}</TableCell>
                                        <TableCell>{d.phone}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(d.amountOwed)}</TableCell>
                                        <TableCell className="text-right text-green-500">{formatCurrency(d.amountPaid)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(d.balance)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <PaginationControls visibleRows={visibleDebtorRows} setVisibleRows={setVisibleDebtorRows} totalRows={debtors.length} />
                    </CardFooter>
                </Card>
            </div>
             <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div>
                            <CardTitle>Debtor/Creditor Ledger</CardTitle>
                            <CardDescription>A summary ledger of debits and credits from the accounting period.</CardDescription>
                        </div>
                         <DateRangeFilter date={date} setDate={setDate} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden space-y-4">
                        {paginatedLedger.map(item => (
                             <Card key={item.id} className="p-4 space-y-2">
                                <p className="font-semibold">{item.description}</p>
                                <p className="text-sm text-muted-foreground">{format(new Date(item.date), 'Pp')}</p>
                                <div className="text-sm pt-2 border-t">
                                    <div className="flex justify-between"><span>Debit:</span><span>{item.debit ? formatCurrency(item.debit) : '-'}</span></div>
                                    <div className="flex justify-between"><span>Credit:</span><span>{item.credit ? formatCurrency(item.credit) : '-'}</span></div>
                                </div>
                            </Card>
                        ))}
                         {paginatedLedger.length === 0 && <p className="text-center text-muted-foreground py-12">No ledger entries for this period.</p>}
                    </div>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date &amp; Time</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedLedger.length === 0 && <TableRow><TableCell colSpan={4} className="h-24 text-center">No ledger entries for this period.</TableCell></TableRow>}
                                {paginatedLedger.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>{format(new Date(item.date), 'Pp')}</TableCell>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell className="text-right">{item.debit ? formatCurrency(item.debit) : '-'}</TableCell>
                                        <TableCell className="text-right">{item.credit ? formatCurrency(item.credit) : '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                             <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={2} className="text-right font-bold">Ground Total</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(debitTotal)}</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(creditTotal)}</TableCell>
                                </TableRow>
                                 <TableRow>
                                    <TableCell colSpan={3} className="text-right font-bold">Outstanding Balance</TableCell>
                                    <TableCell className="text-right font-bold text-destructive">{formatCurrency(debitTotal - creditTotal)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                    <PaginationControls visibleRows={visibleLedgerRows} setVisibleRows={setVisibleLedgerRows} totalRows={filteredLedger.length} />
                </CardFooter>
            </Card>
        </div>
    );
}

function DirectCostsTab({ categories, isReadOnly }: { categories: CostCategory[], isReadOnly?: boolean }) {
    const [costs, setCosts] = useState<DirectCost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [date, setDate] = useState<DateRange | undefined>();
    const [visibleRows, setVisibleRows] = useState<number | 'all'>(10);
    const [viewingCost, setViewingCost] = useState<DirectCost | null>(null);

    const fetchCosts = useCallback(() => {
        setIsLoading(true);
        getDirectCosts().then(data => {
            setCosts(data as DirectCost[]);
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        fetchCosts();
    }, [fetchCosts]);

    const { totalCost, categoryTotals, chartData, filteredCosts } = useMemo(() => {
        let dateFilteredCosts = costs;
        if (date?.from) {
            const from = startOfDay(date.from);
            const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
            dateFilteredCosts = costs.filter(cost => {
                const costDate = new Date(cost.date);
                return costDate >= from && costDate <= to;
            });
        }
        
        const filtered = dateFilteredCosts.filter(cost => cost.description.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const total = filtered.reduce((sum, cost) => sum + cost.total, 0);

        const totals: { [key: string]: number } = filtered.reduce((acc, cost) => {
            acc[cost.category] = (acc[cost.category] || 0) + cost.total;
            return acc;
        }, {});

        const sortedCategories = Object.entries(totals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        const chart = sortedCategories.map(([name, total]) => ({ name, total }));

        return { totalCost: total, categoryTotals: sortedCategories, chartData: chart, filteredCosts: filtered };
    }, [costs, searchTerm, date]);
    
    const paginatedCosts = useMemo(() => {
        return visibleRows === 'all' ? filteredCosts : filteredCosts.slice(0, visibleRows);
    }, [filteredCosts, visibleRows]);


    if (isLoading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <ExpenseDetailDialog isOpen={!!viewingCost} onOpenChange={() => setViewingCost(null)} cost={viewingCost} />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Direct Cost</CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
                        <p className="text-xs text-muted-foreground">For selected period</p>
                    </CardContent>
                </Card>
                {categoryTotals.map(([name, total]) => (
                    <Card key={name}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(total)}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                <Card className="flex-1">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <CardTitle>Direct Costs Log</CardTitle>
                                <CardDescription>All costs directly tied to production, like ingredients.</CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                                <div className="relative w-full sm:w-auto">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                                <DateRangeFilter date={date} setDate={setDate} />
                            </div>
                        </div>
                        <div className="mt-4">
                             <AddDirectCostDialog onCostAdded={fetchCosts} categories={categories} disabled={isReadOnly} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {paginatedCosts.map(c => (
                            <Card key={c.id} className="p-3 flex flex-col md:flex-row justify-between md:items-center gap-2 cursor-pointer hover:bg-muted/50" onClick={() => setViewingCost(c)}>
                                <div className="flex-1 space-y-1">
                                    <p className="font-semibold">{c.description}</p>
                                    <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-2">
                                        <Badge variant="outline" className="text-xs">{c.category}</Badge>
                                        <span>{format(new Date(c.date), 'PPP')}</span>
                                    </div>
                                </div>
                                <div className="flex md:hidden items-center text-muted-foreground self-start mt-2">
                                    <CornerDownRight className="h-4 w-4 mr-2"/>
                                </div>
                                <p className="w-full md:w-auto text-left md:text-right font-bold text-lg">{formatCurrency(c.total)}</p>
                            </Card>
                        ))}
                    </CardContent>
                    <CardFooter>
                        <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={filteredCosts.length} />
                    </CardFooter>
                </Card>
                <Card className="w-full xl:w-1/3">
                    <CardHeader>
                        <CardTitle>Top 5 Expense Categories</CardTitle>
                        <CardDescription>A visual breakdown of your top direct costs.</CardDescription>
                    </CardHeader>
                     <CardContent>
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid horizontal={false} />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={80} />
                                <XAxis dataKey="total" type="number" hide />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function IndirectCostsTab({ categories, isReadOnly }: { categories: CostCategory[], isReadOnly?: boolean }) {
    const [costs, setCosts] = useState<IndirectCost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [date, setDate] = useState<DateRange | undefined>();
    const [visibleRows, setVisibleRows] = useState<number | 'all'>(10);
    const [viewingCost, setViewingCost] = useState<IndirectCost | null>(null);

    const fetchCosts = useCallback(() => {
        setIsLoading(true);
        getIndirectCosts().then(data => {
            setCosts(data as IndirectCost[]);
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        fetchCosts();
    }, [fetchCosts]);

    const { totalCost, categoryTotals, chartData, filteredCosts } = useMemo(() => {
        let dateFilteredCosts = costs;
        if (date?.from) {
            const from = startOfDay(date.from);
            const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
            dateFilteredCosts = costs.filter(cost => {
                const costDate = new Date(cost.date);
                return costDate >= from && costDate <= to;
            });
        }
        
        const filtered = dateFilteredCosts.filter(cost => cost.description.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const total = filtered.reduce((sum, cost) => sum + cost.amount, 0);

        const totals: { [key: string]: number } = filtered.reduce((acc, cost) => {
            acc[cost.category] = (acc[cost.category] || 0) + cost.amount;
            return acc;
        }, {});

        const sortedCategories = Object.entries(totals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        const chart = sortedCategories.map(([name, amount]) => ({ name, amount }));

        return { totalCost: total, categoryTotals: sortedCategories, chartData: chart, filteredCosts: filtered };
    }, [costs, searchTerm, date]);
    
    const paginatedCosts = useMemo(() => {
        return visibleRows === 'all' ? filteredCosts : filteredCosts.slice(0, visibleRows);
    }, [filteredCosts, visibleRows]);

    if (isLoading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <ExpenseDetailDialog isOpen={!!viewingCost} onOpenChange={() => setViewingCost(null)} cost={viewingCost} />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Indirect Cost</CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
                        <p className="text-xs text-muted-foreground">For selected period</p>
                    </CardContent>
                </Card>
                {categoryTotals.map(([name, amount]) => (
                    <Card key={name}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(amount)}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                <Card className="flex-1">
                     <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <CardTitle>Indirect Costs Log</CardTitle>
                                <CardDescription>All operational costs not tied to a single product.</CardDescription>
                            </div>
                             <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                                <div className="relative w-full sm:w-auto">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                                <DateRangeFilter date={date} setDate={setDate} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <AddIndirectCostDialog onCostAdded={fetchCosts} categories={categories} disabled={isReadOnly}/>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {paginatedCosts.map(c => (
                             <Card key={c.id} className="p-3 flex flex-col md:flex-row justify-between md:items-center gap-2 cursor-pointer hover:bg-muted/50" onClick={() => setViewingCost(c)}>
                                <div className="flex-1 space-y-1">
                                    <p className="font-semibold">{c.description}</p>
                                    <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-2">
                                        <Badge variant="outline" className="text-xs">{c.category}</Badge>
                                        <span>{format(new Date(c.date), 'PPP')}</span>
                                    </div>
                                </div>
                                <div className="flex md:hidden items-center text-muted-foreground self-start mt-2">
                                    <CornerDownRight className="h-4 w-4 mr-2"/>
                                </div>
                                <p className="w-full md:w-auto text-left md:text-right font-bold text-lg">{formatCurrency(c.amount)}</p>
                            </Card>
                        ))}
                    </CardContent>
                    <CardFooter>
                        <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={filteredCosts.length} />
                    </CardFooter>
                </Card>
                <Card className="w-full xl:w-1/3">
                    <CardHeader>
                        <CardTitle>Top 5 Expense Categories</CardTitle>
                        <CardDescription>A visual breakdown of your top indirect costs.</CardDescription>
                    </CardHeader>
                     <CardContent>
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid horizontal={false} />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={80} />
                                <XAxis dataKey="amount" type="number" hide />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// --- New Payments & Requests Tab ---
function PaymentsRequestsTab({ user, notificationBadge, isReadOnly }: { user: { staff_id: string; name: string }, notificationBadge?: React.ReactNode, isReadOnly?: boolean }) {
    const { toast } = useToast();
    const [confirmations, setConfirmations] = useState<PaymentConfirmation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actioningId, setActioningId] = useState<string | null>(null);
    const [visiblePendingRows, setVisiblePendingRows] = useState<number | 'all'>(10);
    const [visibleResolvedRows, setVisibleResolvedRows] = useState<number | 'all'>(10);

    const fetchConfirmations = useCallback(() => {
        setIsLoading(true);
        getPaymentConfirmations().then(data => {
            setConfirmations(data);
        }).catch(() => {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch payment confirmations.' });
        }).finally(() => {
            setIsLoading(false);
        });
    }, [toast]);
    
    useEffect(() => {
        fetchConfirmations();
    }, [fetchConfirmations]);

    const handleAction = async (confirmationId: string, action: 'approve' | 'decline') => {
        setActioningId(confirmationId);
        const result = await handlePaymentConfirmation(confirmationId, action);
        if (result.success) {
            toast({ title: 'Success', description: `Payment has been ${action}d.` });
            fetchConfirmations(); // Refresh the list
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setActioningId(null);
    }
    
    const pendingConfirmations = confirmations.filter(c => c.status === 'pending');
    const resolvedConfirmations = confirmations.filter(c => c.status !== 'pending');

    const paginatedPending = useMemo(() => {
        return visiblePendingRows === 'all' ? pendingConfirmations : pendingConfirmations.slice(0, visiblePendingRows);
    }, [pendingConfirmations, visiblePendingRows]);

    const paginatedResolved = useMemo(() => {
        return visibleResolvedRows === 'all' ? resolvedConfirmations : resolvedConfirmations.slice(0, visibleResolvedRows);
    }, [resolvedConfirmations, visibleResolvedRows]);
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <CardTitle>Pending Payment Confirmations</CardTitle>
                            {notificationBadge}
                        </div>
                        <Button variant="ghost" size="sm" onClick={fetchConfirmations} disabled={isLoading}>
                            <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                     <CardDescription>Review and approve cash payments reported by drivers.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                        ) : paginatedPending.length === 0 ? (
                             <p className="text-center text-muted-foreground py-12">No pending confirmations.</p>
                        ) : (
                           paginatedPending.map(c => (
                            <Card key={c.id} className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{formatCurrency(c.amount)}</p>
                                        <p className="text-sm text-muted-foreground">{c.driverName}</p>
                                        <p className="text-xs text-muted-foreground">{format(new Date(c.date), 'Pp')}</p>
                                    </div>
                                    <Badge variant="outline">{c.paymentMethod}</Badge>
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={!!actioningId || isReadOnly}>Decline</Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure you want to decline?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleAction(c.id, 'decline')}>Decline</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <Button size="sm" onClick={() => handleAction(c.id, 'approve')} disabled={actioningId === c.id || isReadOnly}>{actioningId === c.id ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Approve'}</Button>
                                </div>
                            </Card>
                           ))
                        )}
                    </div>
                   <div className="hidden md:block">
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Driver</TableHead><TableHead>Run ID</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                        ) : paginatedPending.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">No pending confirmations.</TableCell></TableRow>
                        ) : (
                            paginatedPending.map(c => (
                            <TableRow key={c.id}>
                                <TableCell>{format(new Date(c.date), 'Pp')}</TableCell>
                                <TableCell>{c.driverName}</TableCell>
                                <TableCell>{c.runId.substring(0, 8)}...</TableCell>
                                <TableCell>{c.customerName}</TableCell>
                                <TableCell>{formatCurrency(c.amount)}</TableCell>
                                <TableCell><Badge variant="outline">{c.paymentMethod}</Badge></TableCell>
                                <TableCell className="text-right">
                                     <div className="flex gap-2 justify-end">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={!!actioningId || isReadOnly}>Decline</Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Are you sure you want to decline?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleAction(c.id, 'decline')}>Decline</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        <Button size="sm" onClick={() => handleAction(c.id, 'approve')} disabled={actioningId === c.id || isReadOnly}>{actioningId === c.id ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Approve'}</Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                            ))
                        )}
                        </TableBody>
                    </Table>
                    </div>
                </CardContent>
                 <CardFooter>
                    <PaginationControls visibleRows={visiblePendingRows} setVisibleRows={setVisiblePendingRows} totalRows={pendingConfirmations.length} />
                </CardFooter>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Resolved Requests</CardTitle>
                    <CardDescription>A log of all previously approved and declined payment requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                        ) : paginatedResolved.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">No resolved requests.</p>
                        ) : (
                             paginatedResolved.map(c => (
                                <Card key={c.id} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{formatCurrency(c.amount)}</p>
                                            <p className="text-sm text-muted-foreground">{c.driverName} - {c.paymentMethod}</p>
                                        </div>
                                        <Badge variant={c.status === 'approved' ? 'default' : 'destructive'}>{c.status}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">{format(new Date(c.date), 'Pp')}</p>
                                </Card>
                             ))
                        )}
                    </div>
                    <div className="hidden md:block">
                    <Table>
                         <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Driver</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                         <TableBody>
                             {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                            ) : paginatedResolved.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">No resolved requests.</TableCell></TableRow>
                            ) : (
                                paginatedResolved.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell>{format(new Date(c.date), 'Pp')}</TableCell>
                                    <TableCell>{c.driverName}</TableCell>
                                    <TableCell>{formatCurrency(c.amount)}</TableCell>
                                    <TableCell><Badge variant="outline">{c.paymentMethod}</Badge></TableCell>
                                    <TableCell><Badge variant={c.status === 'approved' ? 'default' : 'destructive'}>{c.status}</Badge></TableCell>
                                </TableRow>
                                ))
                            )}
                         </TableBody>
                    </Table>
                    </div>
                </CardContent>
                 <CardFooter>
                    <PaginationControls visibleRows={visibleResolvedRows} setVisibleRows={setVisibleResolvedRows} totalRows={resolvedConfirmations.length} />
                </CardFooter>
            </Card>
        </div>
    )
}

function SalesRecordDetailsDialog({ record, isOpen, onOpenChange }: { record: Sale | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    if (!record) return null;
    
    // Check if date is a Firestore Timestamp
    const recordDate = record.date?.toDate ? record.date.toDate() : new Date(record.date);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Sales Details for {format(recordDate, 'PPP')}</DialogTitle>
                    <DialogDescription>A breakdown of the day's sales.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Cash</span><span>{formatCurrency(record.cash)}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">POS</span><span>{formatCurrency(record.pos)}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Transfer</span><span>{formatCurrency(record.transfer)}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Credit Sales</span><span>{formatCurrency(record.creditSales)}</span></div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between items-center font-bold text-base"><span className="text-muted-foreground">Total Sales</span><span>{formatCurrency(record.total)}</span></div>
                    <div className="flex justify-between items-center text-sm text-destructive"><span className="text-muted-foreground">Shortage (from Waste)</span><span>{formatCurrency(record.shortage)}</span></div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function SalesRecordsTab() {
    const [salesRecords, setSalesRecords] = useState<Sale[]>([]);
    const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
    const [products, setProducts] = useState<{ id: string, costPrice: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>();
    const [visibleRows, setVisibleRows] = useState<number | 'all'>(10);
    const [viewingRecord, setViewingRecord] = useState<Sale | null>(null);

    useEffect(() => {
        const fetchSalesData = async () => {
            setIsLoading(true);
            try {
                const salesQuery = query(collection(db, "sales"), orderBy("date", "desc"));
                const unsubSales = onSnapshot(salesQuery, (snapshot) => {
                    setSalesRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
                });

                const wasteQuery = query(collection(db, "waste_logs"), orderBy("date", "desc"));
                const unsubWaste = onSnapshot(wasteQuery, (snapshot) => {
                    setWasteLogs(snapshot.docs.map(doc => doc.data() as WasteLog));
                });
                
                const productsSnapshot = await getDocs(collection(db, "products"));
                setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, costPrice: doc.data().costPrice || 0 })));

                return () => { 
                    unsubSales(); 
                    unsubWaste();
                };
            } catch (error) {
                console.error("Error fetching sales records in real-time: ", error);
            } finally {
                setIsLoading(false);
            }
        };

        const unsubPromise = fetchSalesData();
        return () => {
            unsubPromise.then(unsub => unsub && unsub());
        };
    }, []);

    const processedRecords = useMemo(() => {
        const productCostMap = new Map(products.map(p => [p.id, p.costPrice]));
        const dailyDataMap = new Map<string, Partial<Sale>>();

        // Process sales
        salesRecords.forEach(rec => {
            const date = rec.date?.toDate ? rec.date.toDate() : new Date(rec.date);
            const dateStr = format(date, 'yyyy-MM-dd');
            dailyDataMap.set(dateStr, { ...rec, date, shortage: 0 });
        });

        // Process waste logs
        wasteLogs.forEach(log => {
            const date = log.date && (log.date as any).toDate ? (log.date as any).toDate() : new Date(log.date);
            const dateStr = format(date, 'yyyy-MM-dd');
            const cost = productCostMap.get(log.productId) || 0;
            const wasteValue = cost * log.quantity;

            if (dailyDataMap.has(dateStr)) {
                const existing = dailyDataMap.get(dateStr)!;
                existing.shortage = (existing.shortage || 0) + wasteValue;
            } else {
                dailyDataMap.set(dateStr, {
                    id: `waste-${dateStr}`,
                    date: date,
                    description: `Daily Sales for ${dateStr}`,
                    cash: 0, pos: 0, transfer: 0, creditSales: 0, total: 0,
                    shortage: wasteValue,
                });
            }
        });

        return Array.from(dailyDataMap.values())
            .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)) as Sale[];
            
    }, [salesRecords, wasteLogs, products]);


    const filteredRecords = useMemo(() => {
        if (!date?.from) return processedRecords;
        const from = startOfDay(date.from);
        const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
        return processedRecords.filter(rec => {
            const recDate = new Date(rec.date);
            return recDate >= from && recDate <= to;
        });
    }, [processedRecords, date]);
    
    const paginatedRecords = useMemo(() => {
        return visibleRows === 'all' ? filteredRecords : filteredRecords.slice(0, visibleRows);
    }, [filteredRecords, visibleRows]);

    const grandTotal = useMemo(() => paginatedRecords.reduce((sum, item) => sum + item.total, 0), [paginatedRecords]);

    if (isLoading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <>
            <SalesRecordDetailsDialog record={viewingRecord} isOpen={!!viewingRecord} onOpenChange={() => setViewingRecord(null)} />
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Daily Sales Records</CardTitle>
                            <CardDescription>A log of all daily sales transactions.</CardDescription>
                        </div>
                        <DateRangeFilter date={date} setDate={setDate} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden space-y-4">
                        {paginatedRecords.map(r => (
                            <Card key={r.id} className="p-4 cursor-pointer" onClick={() => setViewingRecord(r)}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{r.description}</p>
                                        <p className="text-xs text-muted-foreground">{r.date ? format(new Date(r.date), 'PPP') : 'Invalid Date'}</p>
                                    </div>
                                    <p className="font-bold text-lg">{formatCurrency(r.total)}</p>
                                </div>
                                <div className="text-xs mt-2 pt-2 border-t flex justify-between">
                                    <span className="text-destructive">Shortage: {formatCurrency(r.shortage)}</span>
                                    <span>Cash: {formatCurrency(r.cash)}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Cash</TableHead>
                                    <TableHead className="text-right">Transfer</TableHead>
                                    <TableHead className="text-right">POS</TableHead>
                                    <TableHead className="text-right">Credit Sales</TableHead>
                                    <TableHead className="text-right">Shortage</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedRecords.map(r => (
                                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted" onClick={() => setViewingRecord(r)}>
                                        <TableCell>{r.date ? format(new Date(r.date), 'PPP') : 'Invalid Date'}</TableCell>
                                        <TableCell>{r.description}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(r.cash)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(r.transfer)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(r.pos)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(r.creditSales)}</TableCell>
                                        <TableCell className="text-right text-destructive">{formatCurrency(r.shortage)}</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(r.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={7} className="font-bold text-right">Grand Total</TableCell>
                                    <TableCell className="font-bold text-right">{formatCurrency(grandTotal)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                    <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={filteredRecords.length} />
                </CardFooter>
            </Card>
        </>
    );
}


function DrinkSalesTab() {
    const [records, setRecords] = useState<DrinkSaleSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [salesMargin, setSalesMargin] = useState(5);
    const [date, setDate] = useState<DateRange | undefined>();
    const [visibleRows, setVisibleRows] = useState<number | 'all'>(10);

    const fetchDrinkSales = useCallback(async (newDate: DateRange | undefined) => {
        setIsLoading(true);
        const range = newDate?.from ? { from: startOfDay(newDate.from), to: endOfDay(newDate.to || newDate.from) } : undefined;
        const data = await getDrinkSalesSummary(range);
        setRecords(data);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchDrinkSales(date);
    }, [date, fetchDrinkSales]);

    const reportData = useMemo(() => {
        return records.map(r => {
            const amountPurchases = r.costPrice * r.quantitySold;
            const amount = r.totalRevenue;
            const salesMarginTotal = amount * (1 + salesMargin / 100);
            const quantityRemaining = r.stock;

            return {
                ...r,
                amountPurchases,
                amount,
                salesMarginTotal,
                quantityRemaining: quantityRemaining > 0 ? quantityRemaining : 'NILL'
            };
        });
    }, [records, salesMargin]);

    const { totals, totalQuantitySold } = useMemo(() => {
        const initialTotals = { purchases: 0, amount: 0, marginTotal: 0 };
        const totals = reportData.reduce((acc, curr) => {
            acc.purchases += curr.amountPurchases;
            acc.amount += curr.amount;
            acc.marginTotal += curr.salesMarginTotal;
            return acc;
        }, initialTotals);
        
        const totalQuantitySold = reportData.reduce((sum, item) => sum + item.quantitySold, 0);

        return { totals, totalQuantitySold };
    }, [reportData]);
    
    const paginatedReport = useMemo(() => {
        return visibleRows === 'all' ? reportData : reportData.slice(0, visibleRows);
    }, [reportData, visibleRows]);

    if (isLoading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Drink Sales Record</CardTitle>
                        <CardDescription>A detailed record of drink sales for the selected period.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="sales-margin" className="shrink-0">Sales Margin %</Label>
                        <Input 
                            id="sales-margin"
                            type="number"
                            value={salesMargin}
                            onChange={e => setSalesMargin(Number(e.target.value))}
                            className="w-20"
                        />
                         <DateRangeFilter date={date} setDate={setDate} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="md:hidden space-y-4">
                    {paginatedReport.map(r => (
                        <Card key={r.productId} className="p-4 space-y-2">
                            <p className="font-semibold">{r.productName}</p>
                            <div className="text-sm pt-2 border-t space-y-1">
                                <div className="flex justify-between"><span>Qty Sold:</span><span>{r.quantitySold}</span></div>
                                <div className="flex justify-between"><span>Qty Rem:</span><span>{r.quantityRemaining}</span></div>
                                <div className="flex justify-between"><span>Amount:</span><span>{formatCurrency(r.amount)}</span></div>
                                <div className="flex justify-between font-bold"><span>Total (+Margin):</span><span>{formatCurrency(r.salesMarginTotal)}</span></div>
                            </div>
                        </Card>
                    ))}
                 </div>
                 <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type of Drink</TableHead>
                                <TableHead className="text-right">Amount Purchases</TableHead>
                                <TableHead className="text-right">Quantity Sold</TableHead>
                                <TableHead className="text-right">Quantity Remaining</TableHead>
                                <TableHead className="text-right">Selling Price</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Sales Margin Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedReport.map(r => (
                                <TableRow key={r.productId}>
                                    <TableCell>{r.productName}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(r.amountPurchases)}</TableCell>
                                    <TableCell className="text-right">{r.quantitySold}</TableCell>
                                    <TableCell className="text-right">{r.quantityRemaining}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(r.totalRevenue / r.quantitySold)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(r.salesMarginTotal)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell className="font-bold">Grand Total</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.purchases)}</TableCell>
                                <TableCell className="text-right font-bold">{totalQuantitySold}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.amount)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.marginTotal)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
            <CardFooter>
                <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={reportData.length} />
            </CardFooter>
        </Card>
    );
}

function ClosingStockTab() {
    const [closingStock, setClosingStock] = useState<ClosingStock[]>([]);
    const [badBread, setBadBread] = useState<WasteLog[]>([]);
    const [discounts, setDiscounts] = useState<DiscountRecord[]>([]);
    const [loanAccount, setLoanAccount] = useState<DebtRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>();
    const [visibleRows, setVisibleRows] = useState<number | 'all'>(10);
    const [stockFilter, setStockFilter] = useState<'all' | 'products' | 'ingredients'>('all');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [csData, wasteData, discountData, debtData] = await Promise.all([
                getClosingStocks(stockFilter === 'all' ? undefined : stockFilter),
                getWasteLogs(),
                getDiscountRecords(),
                getDebtRecords()
            ]);
            setClosingStock(csData as ClosingStock[]);
            setBadBread(wasteData.filter(log => log.reason === 'Damaged'));
            setDiscounts(discountData as DiscountRecord[]);
            setLoanAccount(debtData.filter(d => d.description.toLowerCase().includes('loan')) as DebtRecord[]);
        } catch (error) {
            console.error("Error fetching closing stock data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [stockFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredBadBread = useMemo(() => {
        if (!date?.from) return badBread;
        const from = startOfDay(date.from);
        const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
        return badBread.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= from && logDate <= to;
        });
    }, [badBread, date]);
    
    const filteredLoanAccount = useMemo(() => {
        if (!date?.from) return loanAccount;
        const from = startOfDay(date.from);
        const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
        return loanAccount.filter(rec => {
            const recDate = new Date(rec.date);
            return recDate >= from && recDate <= to;
        });
    }, [loanAccount, date]);

    const paginatedBadBread = useMemo(() => {
        return visibleRows === 'all' ? filteredBadBread : filteredBadBread.slice(0, visibleRows);
    }, [filteredBadBread, visibleRows]);

    const paginatedLoanAccount = useMemo(() => {
        return visibleRows === 'all' ? filteredLoanAccount : filteredLoanAccount.slice(0, visibleRows);
    }, [filteredLoanAccount, visibleRows]);


    const totalClosingStock = useMemo(() => closingStock.reduce((sum, item) => sum + (item.value || 0), 0), [closingStock]);
    const totalDiscounts = useMemo(() => discounts.reduce((sum, item) => sum + (item.amount || 0), 0), [discounts]);
    const totalLoanDebit = useMemo(() => paginatedLoanAccount.reduce((sum, item) => sum + (item.debit || 0), 0), [paginatedLoanAccount]);
    
    if (isLoading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="space-y-6">
             <div className="flex justify-end items-center gap-4">
                <DateRangeFilter date={date} setDate={setDate} />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div>
                            <CardTitle>Closing Stock</CardTitle>
                            <CardDescription>Value of inventory at the end of the accounting period.</CardDescription>
                        </div>
                         <Select value={stockFilter} onValueChange={(val: any) => setStockFilter(val)}>
                            <SelectTrigger className="w-full sm:w-[180px] mt-2 sm:mt-0">
                                <SelectValue placeholder="Filter by type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Stock</SelectItem>
                                <SelectItem value="products">Products</SelectItem>
                                <SelectItem value="ingredients">Ingredients</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>
                    <CardContent>
                        <div className="md:hidden space-y-4">
                            {closingStock.map(r => (
                                <Card key={r.name} className="p-4 space-y-2">
                                    <p className="font-semibold">{r.name}</p>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Quantity:</span>
                                        <span>{r.quantity.toFixed(2)} {r.unit}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-muted-foreground">Amount:</span>
                                        <span>{formatCurrency(r.value)}</span>
                                    </div>
                                </Card>
                            ))}
                        </div>
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead className="text-right">Quantity</TableHead>
                                        <TableHead className="text-right">Amount (₦)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {closingStock.map(r => (
                                        <TableRow key={r.name}>
                                            <TableCell>{r.name}</TableCell>
                                            <TableCell className="text-right">{r.quantity.toFixed(2)} {r.unit}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(r.value)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={2} className="font-bold text-right">Total Closing Stock</TableCell>
                                        <TableCell className="font-bold text-right">{formatCurrency(totalClosingStock)}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Loan Account</CardTitle>
                        <CardDescription>A log of business loans.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="md:hidden space-y-4">
                            {paginatedLoanAccount.map(r => (
                                <Card key={r.id} className="p-4 space-y-2">
                                    <p className="font-semibold">{r.description}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(r.date), 'PPP')}</p>
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-muted-foreground">Debit:</span>
                                        <span>{formatCurrency(r.debit)}</span>
                                    </div>
                                </Card>
                            ))}
                        </div>
                        <div className="hidden md:block">
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead></TableRow></TableHeader>
                            <TableBody>{paginatedLoanAccount.map(r => <TableRow key={r.id}><TableCell>{format(new Date(r.date), 'PPP')}</TableCell><TableCell>{r.description}</TableCell><TableCell className="text-right">{formatCurrency(r.debit)}</TableCell></TableRow>)}</TableBody>
                            <TableFooter><TableRow><TableCell colSpan={2} className="font-bold text-right">Total Loan</TableCell><TableCell className="font-bold text-right">{formatCurrency(totalLoanDebit)}</TableCell></TableRow></TableFooter>
                        </Table>
                        </div>
                    </CardContent>
                     <CardFooter>
                        <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={filteredLoanAccount.length} />
                    </CardFooter>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Bad and Damage Bread</CardTitle>
                        <CardDescription>A log of bread reported as damaged.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="md:hidden space-y-4">
                            {paginatedBadBread.map(r => (
                                <Card key={r.id} className="p-4 flex justify-between items-center">
                                    <p className="font-semibold">{r.productName}</p>
                                    <p className="font-bold">{r.quantity}</p>
                                </Card>
                            ))}
                        </div>
                        <div className="hidden md:block">
                        <Table>
                            <TableHeader><TableRow><TableHead>Bread Type</TableHead><TableHead className="text-right">Quantity</TableHead></TableRow></TableHeader>
                            <TableBody>{paginatedBadBread.map(r => <TableRow key={r.id}><TableCell>{r.productName}</TableCell><TableCell className="text-right">{r.quantity}</TableCell></TableRow>)}</TableBody>
                        </Table>
                        </div>
                    </CardContent>
                     <CardFooter>
                        <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={filteredBadBread.length} />
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Discount Allowed</CardTitle>
                        <CardDescription>A log of discounts given on bread types.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="md:hidden space-y-4">
                            {discounts.map(r => (
                                <Card key={r.id} className="p-4 flex justify-between items-center">
                                    <p className="font-semibold">{r.bread_type}</p>
                                    <p className="font-bold">{formatCurrency(r.amount)}</p>
                                </Card>
                            ))}
                        </div>
                        <div className="hidden md:block">
                         <Table>
                            <TableHeader><TableRow><TableHead>Bread Type</TableHead><TableHead className="text-right">Amount (₦)</TableHead></TableRow></TableHeader>
                            <TableBody>{discounts.map(r => <TableRow key={r.id}><TableCell>{r.bread_type}</TableCell><TableCell className="text-right">{formatCurrency(r.amount)}</TableCell></TableRow>)}</TableBody>
                            <TableFooter><TableRow><TableCell className="font-bold text-right">Total Discount</TableCell><TableCell className="font-bold text-right">{formatCurrency(totalDiscounts)}</TableCell></TableRow></TableFooter>
                        </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function WagesTab() {
    const [records, setRecords] = useState<Wage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [visibleRows, setVisibleRows] = useState<number | 'all'>(10);
    const [date, setDate] = useState<DateRange | undefined>();

    const fetchWages = useCallback(async (newDate: DateRange | undefined) => {
        setIsLoading(true);
        const range = newDate?.from ? { from: startOfDay(newDate.from), to: endOfDay(newDate.to || newDate.from) } : undefined;
        const data = await getWages(range);
        setRecords(data as Wage[]);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchWages(date);
    }, [date, fetchWages]);

    const totals = useMemo(() => {
        return records.reduce((acc, curr) => {
            acc.salary += curr.basePay || 0;
            acc.shortages += curr.deductions?.shortages || 0;
            acc.advanceSalary += curr.deductions?.advanceSalary || 0;
            acc.debt += curr.deductions?.debt || 0;
            acc.fine += curr.deductions?.fine || 0;
            acc.netPay += curr.netPay || 0;
            return acc;
        }, { salary: 0, shortages: 0, advanceSalary: 0, debt: 0, fine: 0, netPay: 0 });
    }, [records]);
    
    const paginatedRecords = useMemo(() => {
        return visibleRows === 'all' ? records : records.slice(0, visibleRows);
    }, [records, visibleRows]);

    if (isLoading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const totalDeductions = (r: Wage) => (r.deductions?.shortages || 0) + (r.deductions?.advanceSalary || 0) + (r.deductions?.debt || 0) + (r.deductions?.fine || 0);

    return (
        <Card>
            <CardHeader>
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div>
                        <CardTitle>Wages &amp; Salaries</CardTitle>
                        <CardDescription>Monthly staff emolument records.</CardDescription>
                    </div>
                    <DateRangeFilter date={date} setDate={setDate} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="md:hidden space-y-4">
                    {paginatedRecords.map(r => (
                        <Card key={r.id} className="p-4 space-y-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold">{r.staffName}</p>
                                    <p className="text-sm text-muted-foreground">{r.role}</p>
                                </div>
                                <p className="font-bold text-lg">{formatCurrency(r.netPay)}</p>
                            </div>
                             <div className="text-sm pt-2 border-t">
                                <div className="flex justify-between"><span>Salary:</span><span>{formatCurrency(r.basePay)}</span></div>
                                <div className="flex justify-between"><span>Deductions:</span><span className="text-destructive">{formatCurrency(totalDeductions(r))}</span></div>
                            </div>
                        </Card>
                    ))}
                </div>
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="text-right">Salary</TableHead>
                                <TableHead className="text-right">Total Deductions</TableHead>
                                <TableHead className="text-right">Net Pay</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedRecords.map(r => (
                                <TableRow key={r.id}>
                                    <TableCell>{r.staffName}</TableCell>
                                    <TableCell>{r.role}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(r.basePay)}</TableCell>
                                    <TableCell className="text-right text-destructive">{formatCurrency(totalDeductions(r))}</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(r.netPay)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={2} className="text-right font-bold">Total</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.salary)}</TableCell>
                                <TableCell className="text-right font-bold text-destructive">{formatCurrency(totals.shortages + totals.advanceSalary + totals.debt + totals.fine)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.netPay)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
            <CardFooter>
                <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={records.length} />
            </CardFooter>
        </Card>
    );
}

function BusinessHealthTab() {
    const [statement, setStatement] = useState<ProfitAndLossStatement | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });

    const fetchStatement = useCallback(async (newDate: DateRange | undefined) => {
        setIsLoading(true);
        const range = newDate?.from ? { from: startOfDay(newDate.from), to: endOfDay(newDate.to || newDate.from) } : undefined;
        const data = await getProfitAndLossStatement(range);
        setStatement(data);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchStatement(date);
    }, [date, fetchStatement]);
    
    if (isLoading || !statement) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const { sales, cogs, expenseDetails } = statement;
    const totalOpex = cogs + expenseDetails.Utilities + expenseDetails.Operations + expenseDetails.Wages;
    const opexRatios = {
        COGS: sales > 0 ? (cogs / sales) * 100 : 0,
        Utilities: sales > 0 ? (expenseDetails.Utilities / sales) * 100 : 0,
        Operations: sales > 0 ? (expenseDetails.Operations / sales) * 100 : 0,
        Wages: sales > 0 ? (expenseDetails.Wages / sales) * 100 : 0,
    };
    const totalOpexRatio = Object.values(opexRatios).reduce((a,b) => a + b, 0);

    const commentary = () => {
        const issues = [];
        if (totalOpex > sales) {
            issues.push(`The Business overhead cost exceeds the revenue by ${Math.round((totalOpex/sales -1) * 100)}% which makes it very unprofitable.`);
        }
        if (opexRatios.Wages > 70) {
            issues.push("Reduce the Direct labour cost.");
        }
        if (opexRatios.Utilities / totalOpexRatio > 0.43) {
             issues.push("Provide alternate Power supplies, as these alone takes over 43% of sales revenue.");
        }
        if (issues.length === 0) return ["Business appears to be in a healthy state for the selected period."];
        return ["To improve sales. We should;", ...issues];
    };

    const getRatioColor = (ratio: number, benchmark: number, type: 'above' | 'below') => {
        if (type === 'below' && ratio < benchmark) return "text-orange-500";
        if (type === 'above' && ratio > benchmark) return "text-orange-500";
        return "text-green-500";
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <DateRangeFilter date={date} setDate={setDate} />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <Card className="flex flex-col h-full">
                    <CardHeader>
                        <CardTitle>OPEX Breakdown</CardTitle>
                        <CardDescription>Operating expenses for the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 flex-grow">
                        <Accordion type="single" collapsible defaultValue="cogs" className="w-full">
                            <AccordionItem value="cogs">
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4"><span>COGS (Cost of Goods Sold)</span><span className="font-semibold">{formatCurrency(cogs)}</span></div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableBody>
                                            <TableRow><TableCell>Confectionaries</TableCell><TableCell className="text-right">{formatCurrency(statement.purchases)}</TableCell></TableRow>
                                            <TableRow><TableCell>Less: Closing Stocks</TableCell><TableCell className="text-right">({formatCurrency(statement.closingStock)})</TableCell></TableRow>
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="utilities">
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4"><span>Utilities</span><span className="font-semibold">{formatCurrency(expenseDetails.Utilities)}</span></div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableBody>
                                            {Object.entries(statement.expenses).filter(([key]) => ['Diesel', 'Petrol', 'Gas', 'Electricity', 'Water'].includes(key)).map(([key, val]) => (
                                                <TableRow key={key}><TableCell>{key}</TableCell><TableCell className="text-right">{formatCurrency(val as number)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="operations">
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4"><span>Operations</span><span className="font-semibold">{formatCurrency(expenseDetails.Operations)}</span></div>
                                </AccordionTrigger>
                                <AccordionContent>
                                     <Table>
                                        <TableBody>
                                            {Object.entries(statement.expenses).filter(([key]) => ['Repairs', 'Production', 'Promotion', 'Transport', 'Purchases'].includes(key)).map(([key, val]) => (
                                                <TableRow key={key}><TableCell>{key}</TableCell><TableCell className="text-right">{formatCurrency(val as number)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="wages">
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4"><span>Wages</span><span className="font-semibold">{formatCurrency(expenseDetails.Wages)}</span></div>
                                </AccordionTrigger>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                    <CardFooter>
                         <div className="pt-2 border-t mt-2 flex justify-between font-bold text-lg w-full">
                            <span>GRAND TOTAL OPEX:</span>
                            <span>{formatCurrency(totalOpex)}</span>
                        </div>
                    </CardFooter>
                </Card>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ratio Profiling with Revenue</CardTitle>
                            <CardDescription>Comparison of expense ratios to industry benchmarks.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>OPEX Category</TableHead>
                                        <TableHead className="text-right">Ratio</TableHead>
                                        <TableHead className="text-right">Benchmark</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                     <TableRow>
                                        <TableCell>COGS</TableCell>
                                        <TableCell className={cn("text-right", getRatioColor(opexRatios.COGS, 35, 'below'))}>{opexRatios.COGS.toFixed(0)}%</TableCell>
                                        <TableCell className="text-right">41% (Shouldn't fall below 35%)</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Utilities</TableCell>
                                        <TableCell className="text-right">{opexRatios.Utilities.toFixed(0)}%</TableCell>
                                        <TableCell className="text-right">75%</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Operations</TableCell>
                                        <TableCell className="text-right">{opexRatios.Operations.toFixed(0)}%</TableCell>
                                        <TableCell className="text-right">89%</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Wages</TableCell>
                                        <TableCell className="text-right">{opexRatios.Wages.toFixed(0)}%</TableCell>
                                        <TableCell className="text-right">88%</TableCell>
                                    </TableRow>
                                </TableBody>
                                 <TableFooter>
                                    <TableRow>
                                        <TableCell className="font-bold">Total OPEX Ratio</TableCell>
                                        <TableCell colSpan={2} className={cn("text-right font-bold", getRatioColor(totalOpexRatio, 70, 'above'))}>{totalOpexRatio.toFixed(0)}% (shouldn't exceed 70%)</TableCell>
                                    </TableRow>
                                 </TableFooter>
                            </Table>
                            </div>
                             <Progress value={totalOpexRatio > 100 ? 100 : totalOpexRatio} className={cn("mt-2", totalOpexRatio > 70 ? "[&>div]:bg-orange-500" : "[&>div]:bg-green-500")} />
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><MessageSquareQuote /> Commentary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            {commentary().map((line, index) => <p key={index}>{line}</p>)}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function ApprovalsTab({ user, notificationBadge, isReadOnly }: { user: { staff_id: string; name: string }, notificationBadge?: React.ReactNode, isReadOnly?: boolean }) {
    const { toast } = useToast();
    const [requests, setRequests] = useState<SupplyRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actioningId, setActioningId] = useState<string | null>(null);
    const [costPerUnit, setCostPerUnit] = useState<number | string>('');
    const [totalCost, setTotalCost] = useState<number | string>('');
    const [selectedRequest, setSelectedRequest] = useState<SupplyRequest | null>(null);

    const fetchRequests = useCallback(() => {
        setIsLoading(true);
        getPendingSupplyRequests().then(data => {
            setRequests(data);
        }).catch(err => {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch supply requests.' });
        }).finally(() => {
            setIsLoading(false);
        });
    }, [toast]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);
    
    useEffect(() => {
        if (selectedRequest && costPerUnit) {
            setTotalCost(Number(costPerUnit) * selectedRequest.quantity);
        } else {
            setTotalCost('');
        }
    }, [costPerUnit, selectedRequest])

    const handleApprove = async () => {
        if (!selectedRequest || !costPerUnit || !totalCost) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill in cost details.' });
            return;
        }
        setActioningId(selectedRequest.id);
        const result = await approveStockIncrease(selectedRequest.id, Number(costPerUnit), Number(totalCost), user);
        if (result.success) {
            toast({ title: 'Success', description: 'Stock request approved.' });
            fetchRequests();
            setSelectedRequest(null);
            setCostPerUnit('');
            setTotalCost('');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setActioningId(null);
    };

    const handleDecline = async (requestId: string) => {
        setActioningId(requestId);
        const result = await declineStockIncrease(requestId, user);
        if (result.success) {
            toast({ title: 'Success', description: 'Request declined.' });
            fetchRequests();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setActioningId(null);
    }
    
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <CardTitle>Supply &amp; Cost Approvals</CardTitle>
                        {notificationBadge}
                    </div>
                    <Button variant="ghost" size="sm" onClick={fetchRequests} disabled={isLoading}>
                        <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
                <CardDescription>Review and approve stock increase requests from the storekeeper.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="md:hidden space-y-4">
                    {isLoading ? (
                        <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                    ) : requests.length === 0 ? (
                        <p className="text-center text-muted-foreground py-12">No pending supply requests.</p>
                    ) : (
                        requests.map(req => (
                            <Card key={req.id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{req.ingredientName}</p>
                                        <p className="text-sm text-muted-foreground">Qty: {req.quantity}</p>
                                        <p className="text-xs text-muted-foreground">From: {req.requesterName} on {format(new Date(req.requestDate), 'PPP')}</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Button size="sm" onClick={() => setSelectedRequest(req)} disabled={isReadOnly}>Approve</Button>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm" disabled={!!actioningId || isReadOnly}>Decline</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDecline(req.id)}>Decline</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
                <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Requester</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                        ) : requests.length === 0 ? (
                             <TableRow><TableCell colSpan={5} className="h-24 text-center">No pending supply requests.</TableCell></TableRow>
                        ) : (
                            requests.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell>{format(new Date(req.requestDate), 'PPP')}</TableCell>
                                    <TableCell>{req.requesterName}</TableCell>
                                    <TableCell>{req.ingredientName}</TableCell>
                                    <TableCell className="text-right">{req.quantity}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm" disabled={!!actioningId || isReadOnly}>Decline</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDecline(req.id)}>Decline</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            <Button size="sm" onClick={() => setSelectedRequest(req)} disabled={isReadOnly}>Approve</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                </div>
            </CardContent>

            <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve: {selectedRequest?.quantity}x {selectedRequest?.ingredientName}</DialogTitle>
                        <DialogDescription>
                            Enter the cost details for this supply from {selectedRequest?.supplierName}. This action will update inventory and financial records.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Cost per Unit (₦)</Label>
                            <Input type="number" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Total Cost (₦)</Label>
                            <Input type="number" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedRequest(null)}>Cancel</Button>
                        <Button onClick={handleApprove} disabled={actioningId === selectedRequest?.id}>
                             {actioningId === selectedRequest?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Approve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}


export default function AccountingPage() {
  const [notificationCounts, setNotificationCounts] = useState({ payments: 0, approvals: 0 });
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const { toast } = useToast();
  const [user, setUser] = useState<{staff_id: string; name: string, role: string} | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('loggedInUser');
    if (userStr) {
        setUser(JSON.parse(userStr));
    }

    const unsubCategories = onSnapshot(collection(db, "cost_categories"), (snapshot) => {
        setCostCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CostCategory)));
    });

    const qPayments = query(collection(db, "payment_confirmations"), where('status', '==', 'pending'));
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
        setNotificationCounts(prev => ({...prev, payments: snapshot.size }));
    });
    
    const qApprovals = query(collection(db, "supply_requests"), where('status', '==', 'pending'));
    const unsubApprovals = onSnapshot(qApprovals, (snapshot) => {
        setNotificationCounts(prev => ({...prev, approvals: snapshot.size }));
    });

    return () => {
      unsubPayments();
      unsubApprovals();
      unsubCategories();
    }
  }, [])
  
    const handleAddCategory = async (name: string, type: 'direct' | 'indirect') => {
        if (costCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            toast({ variant: 'destructive', title: 'Error', description: 'This category already exists.'});
            return;
        }
        await addDoc(collection(db, "cost_categories"), { name, type });
        toast({ title: 'Success', description: 'Category added.' });
    };

    const handleDeleteCategory = async (id: string) => {
        await deleteDoc(doc(db, "cost_categories", id));
        toast({ title: 'Success', description: 'Category removed.' });
    };
    
    const directCategories = costCategories.filter(c => c.type === 'direct');
    const indirectCategories = costCategories.filter(c => c.type === 'indirect');
    
    const isReadOnly = user?.role === 'Manager';


  if (!user) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold font-headline">Accounting</h1>
      <Tabs defaultValue="summary" className="space-y-4">
        <div className="overflow-x-auto pb-2">
            <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="pnl-statement">P&amp;L Statement</TabsTrigger>
                <TabsTrigger value="business-health">Business Health</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="debt-payments">Debt &amp; Payments</TabsTrigger>
                <TabsTrigger value="assets-wages">Assets &amp; Wages</TabsTrigger>
                 <TabsTrigger value="approvals" className="relative">
                    Approvals
                    {(notificationCounts.approvals + notificationCounts.payments) > 0 && <Badge variant="destructive" className="ml-2">{notificationCounts.approvals + notificationCounts.payments}</Badge>}
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="summary"><SummaryTab /></TabsContent>
        <TabsContent value="pnl-statement"><FinancialsTab /></TabsContent>
        <TabsContent value="business-health"><BusinessHealthTab /></TabsContent>
        <TabsContent value="expenses">
            <Tabs defaultValue="indirect" className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <TabsList>
                        <TabsTrigger value="indirect">Indirect Costs</TabsTrigger>
                        <TabsTrigger value="direct">Direct Costs</TabsTrigger>
                    </TabsList>
                    <ManageCategoriesDialog 
                        categories={costCategories}
                        onAdd={handleAddCategory}
                        onDelete={handleDeleteCategory}
                        disabled={isReadOnly}
                    />
                </div>
                <TabsContent value="indirect"><IndirectCostsTab categories={indirectCategories} isReadOnly={isReadOnly} /></TabsContent>
                <TabsContent value="direct"><DirectCostsTab categories={directCategories} isReadOnly={isReadOnly} /></TabsContent>
            </Tabs>
        </TabsContent>
        <TabsContent value="sales">
             <Tabs defaultValue="sales-records" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="sales-records">Sales Records</TabsTrigger>
                    <TabsTrigger value="drink-sales">Drink Sales</TabsTrigger>
                </TabsList>
                <TabsContent value="sales-records"><SalesRecordsTab /></TabsContent>
                <TabsContent value="drink-sales"><DrinkSalesTab /></TabsContent>
            </Tabs>
        </TabsContent>
        <TabsContent value="debt-payments">
            <DebtorsCreditorsTab isReadOnly={isReadOnly} />
        </TabsContent>
         <TabsContent value="assets-wages">
            <Tabs defaultValue="closing-stock" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="closing-stock">Closing Stock</TabsTrigger>
                    <TabsTrigger value="wages">Wages</TabsTrigger>
                </TabsList>
                <TabsContent value="closing-stock"><ClosingStockTab /></TabsContent>
                <TabsContent value="wages"><WagesTab /></TabsContent>
            </Tabs>
        </TabsContent>
        <TabsContent value="approvals">
            <Tabs defaultValue="stock-requests" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="stock-requests" className="relative">
                        Stock Requests 
                        {notificationCounts.approvals > 0 && <Badge variant="destructive" className="ml-2">{notificationCounts.approvals}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="payment-requests" className="relative">
                        Payment &amp; Expense Requests
                        {notificationCounts.payments > 0 && <Badge variant="destructive" className="ml-2">{notificationCounts.payments}</Badge>}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="stock-requests">
                    <ApprovalsTab user={user} notificationBadge={null} isReadOnly={isReadOnly}/>
                </TabsContent>
                <TabsContent value="payment-requests">
                    <PaymentsRequestsTab user={user} notificationBadge={null} isReadOnly={isReadOnly}/>
                </TabsContent>
            </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
