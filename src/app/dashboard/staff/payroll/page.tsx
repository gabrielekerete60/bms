
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStaffList, processPayroll, hasPayrollBeenProcessed, requestAdvanceSalary, getWages } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";


type StaffMember = {
    id: string;
    name: string;
    role: string;
    pay_rate: number;
    pay_type: 'Salary' | 'Hourly';
};

type PayrollEntry = {
    staffId: string;
    staffName: string;
    role: string;
    basePay: number;
    additions: number;
    totalDeductions: number;
};

type WageRecord = {
    id: string;
    staffName: string;
    description: string;
    date: string;
    netPay: number;
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

function PayrollTab() {
    const { toast } = useToast();
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [payrollData, setPayrollData] = useState<Record<string, PayrollEntry>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [payrollPeriod, setPayrollPeriod] = useState<Date>(new Date());
    const [tempValues, setTempValues] = useState<Record<string, { additions?: string, deductions?: string }>>({});
    const [isPayrollProcessed, setIsPayrollProcessed] = useState(false);

    const initializePayroll = useCallback(async (staff: StaffMember[], period: Date) => {
        const periodString = format(period, 'MMMM yyyy');
        
        // Fetch advances for the selected period
        const advancesQuery = query(collection(db, 'wages'), where('month', '==', periodString), where('isAdvance', '==', true));
        const advancesSnapshot = await getDocs(advancesQuery);
        const advancesByStaff: Record<string, number> = {};
        advancesSnapshot.forEach(doc => {
            const data = doc.data();
            advancesByStaff[data.staffId] = (advancesByStaff[data.staffId] || 0) + Math.abs(data.netPay);
        });

        const initialPayroll = staff.reduce((acc, s) => {
            acc[s.id] = {
                staffId: s.id,
                staffName: s.name,
                role: s.role,
                basePay: s.pay_rate || 0,
                additions: 0,
                totalDeductions: advancesByStaff[s.id] || 0,
            };
            return acc;
        }, {} as Record<string, PayrollEntry>);
        setPayrollData(initialPayroll);
    }, []);
    
    useEffect(() => {
        const fetchStaffAndPayrollStatus = async () => {
            setIsLoading(true);
            try {
                const staff = await getStaffList();
                setStaffList(staff);
                
                if (staff.length > 0) {
                    await initializePayroll(staff, payrollPeriod);
                    const periodString = format(payrollPeriod, 'MMMM yyyy');
                    const alreadyProcessed = await hasPayrollBeenProcessed(periodString);
                    setIsPayrollProcessed(alreadyProcessed);
                } else {
                    setIsPayrollProcessed(false);
                }
            } catch (error) {
                console.error("Error fetching staff or payroll status:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load initial data.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchStaffAndPayrollStatus();
    }, [payrollPeriod, toast, initializePayroll]);


    const handleTempChange = (staffId: string, field: 'additions' | 'deductions', value: string) => {
        setTempValues(prev => ({
            ...prev,
            [staffId]: {
                ...prev[staffId],
                [field]: value
            }
        }));
    };
    
    const applyChange = (staffId: string, field: 'additions' | 'totalDeductions') => {
        const tempFieldKey = field === 'additions' ? 'additions' : 'deductions';
        const valueStr = tempValues[staffId]?.[tempFieldKey];
        
        if (valueStr === undefined || valueStr === '') return;

        const numValue = Number(valueStr);
        if (isNaN(numValue)) return;
        
        setPayrollData(prev => {
            const newPayroll = { ...prev };
            const currentEntry = newPayroll[staffId];
            if (currentEntry) {
                const currentValue = currentEntry[field] || 0;
                newPayroll[staffId] = { ...currentEntry, [field]: currentValue + numValue };
            }
            return newPayroll;
        });

        setTempValues(prev => {
            const newStaffValues = { ...prev[staffId] };
            delete newStaffValues[tempFieldKey];
            return {
                ...prev,
                [staffId]: newStaffValues
            };
        });
    };

    const calculateTotals = (entry: PayrollEntry) => {
        const basePay = entry.basePay || 0;
        const additions = entry.additions || 0;
        const totalDeductions = entry.totalDeductions || 0;
        const grossPay = basePay + additions;
        const netPay = grossPay - totalDeductions;
        return { grossPay, netPay, totalDeductions };
    };
    
    const handleProcessPayroll = async () => {
        if (!payrollData || Object.keys(payrollData).length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'No payroll data to process.'});
            return;
        }

        setIsProcessing(true);
        const payrollDataToProcess = Object.values(payrollData).map(p => {
            const { netPay, totalDeductions } = calculateTotals(p);
            // This structure is simplified but allows for future deduction types.
            const simplifiedDeductions = {
                shortages: 0, 
                advanceSalary: totalDeductions, // All deductions are advances for now
                debt: 0,
                fine: 0,
            };
            return {
                ...p,
                netPay,
                deductions: simplifiedDeductions,
                month: format(payrollPeriod, 'MMMM yyyy'),
            };
        });
            
        const result = await processPayroll(payrollDataToProcess, format(payrollPeriod, 'MMMM yyyy'));
        if (result.success) {
            toast({ title: 'Success!', description: 'Payroll has been processed and expenses logged.'});
            setIsPayrollProcessed(true);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsProcessing(false);
    }

    const grandTotals = useMemo(() => {
        return staffList.reduce((acc, staff) => {
            const entry = payrollData[staff.id];
            if (!entry) return acc;
            const { grossPay, netPay, totalDeductions } = calculateTotals(entry);
            acc.basePay += entry.basePay || 0;
            acc.additions += entry.additions || 0;
            acc.totalDeductions += totalDeductions;
            acc.grossPay += grossPay;
            acc.netPay += netPay;
            return acc;
        }, { basePay: 0, additions: 0, totalDeductions: 0, grossPay: 0, netPay: 0 });
    }, [staffList, payrollData]);


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Staff Payroll</CardTitle>
                        <CardDescription>
                            Manage staff salaries for the selected period.
                        </CardDescription>
                    </div>
                     <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(payrollPeriod, 'MMMM yyyy')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    month={payrollPeriod}
                                    onMonthChange={setPayrollPeriod}
                                    captionLayout="dropdown-buttons"
                                    fromYear={2020}
                                    toYear={new Date().getFullYear() + 5}
                                    className="p-0 [&_td]:hidden [&_th]:text-muted-foreground"
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Staff Name</TableHead>
                                <TableHead className="text-right">Base Pay (₦)</TableHead>
                                <TableHead>Additions (₦)</TableHead>
                                <TableHead className="text-right">Gross Pay (₦)</TableHead>
                                <TableHead>Total Deductions (₦)</TableHead>
                                <TableHead className="text-right font-bold">Net Pay (₦)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        No staff members found. Please add staff in the "Staff Management" section.
                                    </TableCell>
                                </TableRow>
                            ) : staffList.map(staff => {
                                const entry = payrollData[staff.id];
                                if (!entry) return null;
                                const { grossPay, netPay, totalDeductions } = calculateTotals(entry);
                                return (
                                    <TableRow key={entry.staffId}>
                                        <TableCell>{entry.staffName}</TableCell>
                                        <TableCell className="text-right">{entry.basePay.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Input 
                                                    type="number"
                                                    className="min-w-24"
                                                    value={tempValues[entry.staffId]?.additions || ''}
                                                    onChange={(e) => handleTempChange(entry.staffId, 'additions', e.target.value)}
                                                    placeholder={entry.additions.toLocaleString()}
                                                    disabled={isPayrollProcessed}
                                                />
                                                <Button size="icon" variant="ghost" onClick={() => applyChange(entry.staffId, 'additions')} disabled={isPayrollProcessed}><Check className="h-4 w-4"/></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">{grossPay.toLocaleString()}</TableCell>
                                        <TableCell>
                                             <div className="flex items-center gap-1">
                                                <Input 
                                                    type="number"
                                                    className="min-w-24"
                                                    value={tempValues[entry.staffId]?.deductions || ''}
                                                    onChange={(e) => handleTempChange(entry.staffId, 'deductions', e.target.value)}
                                                    placeholder={totalDeductions.toLocaleString()}
                                                    disabled={isPayrollProcessed}
                                                />
                                                <Button size="icon" variant="ghost" onClick={() => applyChange(entry.staffId, 'totalDeductions')} disabled={isPayrollProcessed}><Check className="h-4 w-4"/></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">{netPay.toLocaleString()}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                         <TableFooter>
                            <TableRow className="bg-muted/50 font-bold">
                                <TableCell>Grand Totals</TableCell>
                                <TableCell className="text-right">{grandTotals.basePay.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{grandTotals.additions.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{grandTotals.grossPay.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-destructive">{grandTotals.totalDeductions.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{grandTotals.netPay.toLocaleString()}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
            <CardFooter>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button disabled={isProcessing || isLoading || staffList.length === 0 || isPayrollProcessed}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isPayrollProcessed ? 'Payroll Processed' : `Process Payroll for ${format(payrollPeriod, 'MMMM yyyy')}`}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will finalize the payroll for {format(payrollPeriod, 'MMMM yyyy')} and log it as an expense. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleProcessPayroll}>Confirm & Process</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    );
}

function AdvanceSalaryTab() {
    const { toast } = useToast();
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [amount, setAmount] = useState<number | string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [advancePeriod, setAdvancePeriod] = useState(new Date());
    const [isPayrollForPeriodProcessed, setIsPayrollForPeriodProcessed] = useState(false);

    const selectedStaffMember = useMemo(() => staffList.find(s => s.id === selectedStaffId), [staffList, selectedStaffId]);
    const netPay = useMemo(() => selectedStaffMember?.pay_rate || 0, [selectedStaffMember]);

    useEffect(() => {
        getStaffList().then(list => {
            setStaffList(list);
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        const checkStatus = async () => {
            const periodString = format(advancePeriod, 'MMMM yyyy');
            const processed = await hasPayrollBeenProcessed(periodString);
            setIsPayrollForPeriodProcessed(processed);
        };
        checkStatus();
    }, [advancePeriod]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            setAmount('');
            return;
        }
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        
        if (netPay > 0 && numValue > netPay) {
            toast({
                variant: 'destructive',
                title: 'Amount Exceeds Net Pay',
                description: `The maximum advance for this staff is ₦${netPay.toLocaleString()}.`,
            });
            setAmount(netPay);
        } else {
            setAmount(numValue);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStaffId || !amount || Number(amount) <= 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a staff member and enter a valid amount.' });
            return;
        }
        setIsSubmitting(true);
        const periodString = format(advancePeriod, 'MMMM yyyy');
        const result = await requestAdvanceSalary(selectedStaffId, Number(amount), selectedStaffMember?.name || 'Unknown', selectedStaffMember?.role || 'Unknown', periodString);
        if (result.success) {
            toast({ title: 'Success', description: `Salary advance for ${periodString} has been recorded.` });
            setSelectedStaffId('');
            setAmount('');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    }
    
    if (isLoading) {
        return (
             <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Request Salary Advance</CardTitle>
                <CardDescription>
                    Record an advance payment for a staff member. This will be deducted from their next payroll.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label>Period for Deduction</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(advancePeriod, 'MMMM yyyy')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    month={advancePeriod}
                                    onMonthChange={setAdvancePeriod}
                                    captionLayout="dropdown-buttons"
                                    fromYear={new Date().getFullYear()}
                                    toYear={new Date().getFullYear() + 5}
                                    className="p-0 [&_td]:hidden [&_th]:text-muted-foreground"
                                />
                            </PopoverContent>
                        </Popover>
                         {isPayrollForPeriodProcessed && <p className="text-sm text-destructive">Payroll for this month has been processed. No more advances allowed.</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="staff-select">Select Staff Member</Label>
                        <Select value={selectedStaffId} onValueChange={setSelectedStaffId} disabled={isPayrollForPeriodProcessed}>
                            <SelectTrigger id="staff-select">
                                <SelectValue placeholder="Select a staff member..." />
                            </SelectTrigger>
                            <SelectContent>
                                {staffList.map(staff => (
                                    <SelectItem key={staff.id} value={staff.id}>{staff.name} ({staff.role})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     {selectedStaffMember && (
                        <div className="p-3 bg-muted rounded-md text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Staff's Monthly Base Pay:</span>
                                <span className="font-semibold">₦{netPay.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="advance-amount">Amount (₦)</Label>
                        <Input 
                            id="advance-amount" 
                            type="number"
                            value={amount}
                            onChange={handleAmountChange}
                            placeholder="e.g., 10000"
                            disabled={!selectedStaffId || isPayrollForPeriodProcessed}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting || isPayrollForPeriodProcessed}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Record Advance
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}

function AdvanceSalaryLogTab() {
    const [logs, setLogs] = useState<WageRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState(new Date());
    const [visibleRows, setVisibleRows] = useState<number | 'all'>(10);

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            const range = { from: startOfMonth(period), to: endOfMonth(period) };
            const wageLogs = await getWages(range);
            setLogs(wageLogs.filter(w => (w as any).isAdvance) as WageRecord[]);
            setIsLoading(false);
        }
        fetchLogs();
    }, [period]);

    const paginatedLogs = useMemo(() => {
        return visibleRows === 'all' ? logs : logs.slice(0, visibleRows);
    }, [logs, visibleRows]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Advance Salary Log</CardTitle>
                        <CardDescription>
                            A log of all salary advances recorded for the selected period.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(period, 'MMMM yyyy')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    month={period}
                                    onMonthChange={setPeriod}
                                    captionLayout="dropdown-buttons"
                                    fromYear={2020}
                                    toYear={new Date().getFullYear() + 5}
                                    className="p-0 [&_td]:hidden [&_th]:text-muted-foreground"
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date & Time</TableHead>
                                <TableHead>Staff Member</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount (₦)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : paginatedLogs.length === 0 ? (
                                 <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No salary advances recorded for this period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedLogs.map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell>{format(new Date(log.date), 'Pp')}</TableCell>
                                        <TableCell>{log.staffName}</TableCell>
                                        <TableCell>{log.description}</TableCell>
                                        <TableCell className="text-right text-destructive">{Math.abs(log.netPay).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
             <CardFooter>
                <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={logs.length} />
            </CardFooter>
        </Card>
    );
}

export default function PayrollPageContainer() {
    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold font-headline">Payroll</h1>
            <Tabs defaultValue="payroll">
                <TabsList>
                    <TabsTrigger value="payroll">Monthly Payroll</TabsTrigger>
                    <TabsTrigger value="advance">Advance Salary</TabsTrigger>
                    <TabsTrigger value="advance-log">Advance Salary Log</TabsTrigger>
                </TabsList>
                <TabsContent value="payroll" className="mt-4">
                    <PayrollTab />
                </TabsContent>
                <TabsContent value="advance" className="mt-4">
                    <AdvanceSalaryTab />
                </TabsContent>
                <TabsContent value="advance-log" className="mt-4">
                    <AdvanceSalaryLogTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}
