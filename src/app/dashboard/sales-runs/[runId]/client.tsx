
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSalesRunDetails, SalesRun, getCustomersForRun, handleSellToCustomer, handleRecordDebtPaymentForRun, getOrdersForRun, handleCompleteRun, handleReturnStock, handleReportWaste, logRunExpense, getProductsForStaff, getStaffList, getProducts } from '@/app/actions';
import { Loader2, ArrowLeft, User, Package, HandCoins, PlusCircle, Trash2, CreditCard, Wallet, Plus, Minus, Printer, ArrowRightLeft, ArrowUpDown, RefreshCw, Undo2, CheckCircle, Trash, SquareTerminal, FileSignature, Car, Fuel, Receipt as ReceiptIcon, Building, Edit } from 'lucide-react';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select as ShadSelect, SelectContent as ShadSelectContent, SelectItem as ShadSelectItem, SelectTrigger as ShadSelectTrigger, SelectValue as ShadSelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { collection, doc, Timestamp, onSnapshot, query, where, addDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { format } from "date-fns";
import { Textarea } from '@/components/ui/textarea';
import Select from 'react-select';
import { ProductEditDialog } from '@/app/dashboard/components/product-edit-dialog';


type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

type OrderItem = { productId: string; quantity: number, price: number, name: string, costPrice?: number, minPrice?: number, maxPrice?: number };

type CompletedOrder = {
  id: string;
  items: OrderItem[];
  total: number;
  date: Date;
  paymentMethod: 'Paystack' | 'Cash' | 'Credit' | 'POS';
  customerName?: string;
  subtotal: number;
  tax: number;
  status: string;
};

type RunCustomer = {
    customerId: string;
    customerName: string;
    totalSold: number;
    totalPaid: number;
}

type User = {
    name: string;
    role: string;
    staff_id: string;
    email: string;
};

type StaffMember = {
  id: string;
  name: string;
  role: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image: string;
  "data-ai-hint": string;
  costPrice?: number;
  lowStockThreshold?: number;
  minPrice?: number;
  maxPrice?: number;
};

type SortKey = 'customerName' | 'totalSold' | 'totalPaid' | 'outstanding';
type SortDirection = 'asc' | 'desc';

type Expense = {
  id?: string;
  category: string;
  description: string;
  amount: number;
  date?: string | Date;
  runId?: string;
  driverId?: string;
  driverName?: string;
  status?: 'pending' | 'approved' | 'declined';
}

const formatCurrency = (amount?: number) => `₦${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
                        .page-break-before-always { page-break-before: always; }
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

const Receipt = React.forwardRef<HTMLDivElement, { order: CompletedOrder, storeAddress?: string }>(({ order, storeAddress }, ref) => {
  return (
    <div ref={ref} className="p-2">
      <div className="text-center mb-4">
          <h2 className="font-headline text-xl text-center">BMS</h2>
          <p className="text-center text-sm">Sale Receipt</p>
          {storeAddress && <p className="text-center text-xs text-muted-foreground">{storeAddress}</p>}
        </div>
        <div className="py-2 space-y-2 text-xs">
            <div className="space-y-1">
                <p><strong>Order ID:</strong> {order.id.substring(0, 12)}...</p>
                <p><strong>Date:</strong> {new Date(order.date).toLocaleString()}</p>
                <p><strong>Payment Method:</strong> {order.paymentMethod}</p>
                <p><strong>Customer:</strong> {order.customerName || 'Walk-in'}</p>
            </div>
            <Separator className="my-2" />
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="h-auto p-1 text-xs">Item</TableHead>
                    <TableHead className="text-center h-auto p-1 text-xs">Qty</TableHead>
                    <TableHead className="text-right h-auto p-1 text-xs">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {order.items.map((item, index) => (
                    <TableRow key={item.productId || index}>
                        <TableCell className="p-1 text-xs">{item.name}</TableCell>
                        <TableCell className="text-center p-1 text-xs">{item.quantity}</TableCell>
                        <TableCell className="text-right p-1 text-xs">₦{(item.price * item.quantity).toFixed(2)}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
                <Separator className="my-2"/>
                <div className="w-full space-y-1 pr-1">
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

function CreateCustomerDialog({ onCustomerCreated, children }: { onCustomerCreated: (customer: Customer) => void, children: React.ReactNode }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    
    const handleSave = async () => {
        if (!name || !phone) {
            toast({ variant: 'destructive', title: 'Error', description: 'Customer name and phone number are required.'});
            return;
        }
        
        try {
            const newCustomerRef = await addDoc(collection(db, "customers"), {
                name,
                phone,
                email,
                address,
                joinedDate: new Date().toISOString(),
                totalSpent: 0,
                amountOwed: 0,
                amountPaid: 0,
            });
            const newCustomer = { id: newCustomerRef.id, name, phone, email, address, amountOwed: 0, amountPaid: 0 };
            onCustomerCreated(newCustomer as Customer);
            toast({ title: 'Success', description: 'New customer created.' });
            setIsOpen(false);
        } catch(error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create new customer.'});
        }
    }

    return (
       <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Customer</DialogTitle>
                    <DialogDescription>Add a new customer to your database. This will be saved permanently.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="create-customer-name">Customer Name</Label>
                        <Input id="create-customer-name" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="create-customer-phone">Phone Number</Label>
                        <Input id="create-customer-phone" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="create-customer-email">Email (Optional)</Label>
                        <Input id="create-customer-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="create-customer-address">Address (Optional)</Label>
                        <Input id="create-customer-address" value={address} onChange={e => setAddress(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Create Customer</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function SellToCustomerDialog({ run, user, onSaleMade, remainingItems }: { run: SalesRun, user: User | null, onSaleMade: (order: CompletedOrder) => void, remainingItems: OrderItem[] }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Credit' | 'Paystack' | 'POS'>('Cash');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerType, setCustomerType] = useState<'walk-in' | 'registered'>('walk-in');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
    const [customerName, setCustomerName] = useState('');

    const fetchCustomers = useCallback(() => {
        getDocs(collection(db, 'customers')).then(snap => {
            setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
        });
    }, []);

    useEffect(() => {
        if (isOpen) {
           fetchCustomers();
            setCart([]);
            setCustomerType('walk-in');
            setSelectedCustomerId('walk-in');
            setCustomerName('');
            setPaymentMethod('Cash');
        }
    }, [isOpen, fetchCustomers]);
    
    const handleAddToCart = (item: OrderItem) => {
        setCart(prev => {
            const existing = prev.find(p => p.productId === item.productId);
            if (existing) {
                if (existing.quantity < item.quantity) {
                    return prev.map(p => p.productId === item.productId ? { ...p, quantity: p.quantity + 1 } : p);
                } else {
                    toast({ variant: 'destructive', title: 'Stock Limit', description: `Only ${item.quantity} units available.` });
                    return prev;
                }
            }
            return [...prev, { ...item, quantity: 1, name: item.name }];
        });
    };

    const updateCartQuantity = (productId: string, change: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.productId === productId) {
                    const newQuantity = item.quantity + change;
                    const stockLimit = remainingItems.find(i => i.productId === productId)?.quantity || 0;
                    if (newQuantity <= 0) return null;
                    if (newQuantity > stockLimit) {
                         toast({ variant: 'destructive', title: 'Stock Limit', description: `Only ${stockLimit} units available.` });
                         return { ...item, quantity: stockLimit };
                    }
                    return { ...item, quantity: newQuantity };
                }
                return item;
            }).filter(Boolean) as OrderItem[];
        })
    };

    const onCustomerCreated = (newCustomer: Customer) => {
        fetchCustomers();
        setCustomerType('registered');
        setSelectedCustomerId(newCustomer.id);
    }
    
    useEffect(() => {
        if (customerType === 'walk-in') {
            setSelectedCustomerId('walk-in');
            if(paymentMethod === 'Credit') setPaymentMethod('Cash');
        } else {
             setSelectedCustomerId('');
        }
    }, [customerType, paymentMethod]);

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const handleSubmit = async () => {
        if (!user || cart.length === 0 || (paymentMethod === 'Credit' && selectedCustomerId === 'walk-in')) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please add items to cart and select a registered customer for credit sales.' });
            return;
        }

        setIsLoading(true);
        const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

        const saleData = {
            runId: run.id,
            items: cart.map(item => ({...item, productId: item.productId || '' })),
            customerId: selectedCustomerId,
            customerName: customerType === 'walk-in' ? (customerName || 'Walk-in') : (selectedCustomer?.name || 'Registered Customer'),
            paymentMethod,
            staffId: user.staff_id,
            total,
        };
        const result = await handleSellToCustomer(saleData);

        if (result.success && result.orderId) {
            toast({ title: 'Success', description: 'Sale has been recorded.' });
            onSaleMade({
                id: result.orderId,
                items: cart,
                total,
                date: new Date(),
                paymentMethod,
                customerName: saleData.customerName,
                status: 'Completed',
                subtotal: total, tax: 0
            });
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button className="w-full" disabled={run.status !== 'active'}>
                    <PlusCircle className="mr-2 h-5 w-5"/>
                    <span>Standard Sale</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Sell to Customer</DialogTitle>
                    <DialogDescription>Record a sale at the standard product price.</DialogDescription>
                </DialogHeader>
                 <div className="grid md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-2">
                        <h4 className="font-semibold">Available Items</h4>
                        <div className="border rounded-md max-h-96 overflow-y-auto">
                            {remainingItems.map(item => (
                                <div key={item.productId} className="p-2 flex justify-between items-center border-b gap-2">
                                    <div>
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm">Avail: {item.quantity}</p>
                                      <Button size="icon" variant="outline" onClick={() => handleAddToCart(item)}><PlusCircle className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Customer</Label>
                            <div className="flex items-center gap-2">
                                <ShadSelect value={customerType} onValueChange={(v) => setCustomerType(v as any)}>
                                    <ShadSelectTrigger><ShadSelectValue/></ShadSelectTrigger>
                                    <ShadSelectContent>
                                        <ShadSelectItem value="walk-in">Walk-in</ShadSelectItem>
                                        <ShadSelectItem value="registered">Registered</ShadSelectItem>
                                    </ShadSelectContent>
                                </ShadSelect>
                                <CreateCustomerDialog onCustomerCreated={onCustomerCreated}>
                                    <Button variant="outline" size="sm">New Customer</Button>
                                </CreateCustomerDialog>
                            </div>
                        </div>
                        {customerType === 'registered' ? (
                            <ShadSelect value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                                <ShadSelectTrigger><ShadSelectValue placeholder="Select a customer..." /></ShadSelectTrigger>
                                <ShadSelectContent>
                                    {customers.map(c => <ShadSelectItem key={c.id} value={c.id}>{c.name}</ShadSelectItem>)}
                                </ShadSelectContent>
                            </ShadSelect>
                        ) : (
                            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in Customer Name"/>
                        )}

                        <h4 className="font-semibold pt-4">Cart</h4>
                        <div className="border rounded-md p-2 space-y-2 min-h-32 max-h-60 overflow-y-auto">
                           {cart.length === 0 ? <p className="text-center text-muted-foreground text-sm p-4">Cart is empty</p> : (
                                cart.map(item => (
                                    <div key={item.productId} className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateCartQuantity(item.productId, -1)}><Minus className="h-3 w-3"/></Button>
                                            <span className="w-5 text-center font-bold">{item.quantity}</span>
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateCartQuantity(item.productId, 1)}><Plus className="h-3 w-3"/></Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="font-bold text-right">Total: {formatCurrency(total)}</div>
                        <div className="space-y-2">
                            <Label>Payment Method</Label>
                            <ShadSelect onValueChange={(value) => setPaymentMethod(value as any)} value={paymentMethod}>
                                <ShadSelectTrigger><ShadSelectValue/></ShadSelectTrigger>
                                <ShadSelectContent>
                                    <ShadSelectItem value="Cash"><Wallet className="mr-2 h-4 w-4"/> Cash</ShadSelectItem>
                                    <ShadSelectItem value="POS"><SquareTerminal className="mr-2 h-4 w-4"/> POS</ShadSelectItem>
                                    <ShadSelectItem value="Paystack"><ArrowRightLeft className="mr-2 h-4 w-4"/> Paystack</ShadSelectItem>
                                    <ShadSelectItem value="Credit" disabled={customerType==='walk-in'}><CreditCard className="mr-2 h-4 w-4"/> Credit</ShadSelectItem>
                                </ShadSelectContent>
                            </ShadSelect>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Record Sale
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function LogCustomSaleDialog({ run, user, onSaleMade, remainingItems }: { run: SalesRun, user: User | null, onSaleMade: (order: CompletedOrder) => void, remainingItems: OrderItem[] }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'POS' | 'Credit'>('Cash');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerType, setCustomerType] = useState<'walk-in' | 'registered'>('walk-in');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
    const [customerName, setCustomerName] = useState('');
    const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});
    const [stockErrors, setStockErrors] = useState<Record<string, string>>({});

    const fetchCustomers = useCallback(() => {
        getDocs(collection(db, 'customers')).then(snap => {
            setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
        });
    }, []);

    useEffect(() => {
        if (isOpen) {
           fetchCustomers();
            setCart([]);
            setCustomerType('walk-in');
            setSelectedCustomerId('walk-in');
            setCustomerName('');
            setPaymentMethod('Cash');
            setPriceErrors({});
            setStockErrors({});
        }
    }, [isOpen, fetchCustomers]);

    const handlePriceChange = (productId: string, newPriceStr: string) => {
        const newPrice = Number(newPriceStr);
        setCart(prev => prev.map(item => item.productId === productId ? { ...item, price: isNaN(newPrice) ? 0 : newPrice } : item));

        const product = remainingItems.find(p => p.productId === productId);
        const minPrice = product?.minPrice ?? 0;
        const maxPrice = product?.maxPrice ?? Infinity;
        
        setPriceErrors(prev => {
            const newErrors = {...prev};
            if (newPrice < minPrice) {
                newErrors[productId] = `Price cannot be less than ${formatCurrency(minPrice)}.`;
            } else if (newPrice > maxPrice) {
                 newErrors[productId] = `Price cannot be more than ${formatCurrency(maxPrice)}.`;
            } else {
                delete newErrors[productId];
            }
            return newErrors;
        });
    };

    const handleItemChange = (index: number, field: 'productId' | 'quantity', value: string) => {
        const newItems = [...cart];
        const item = newItems[index];

        if(field === 'productId') {
            const product = remainingItems.find(p => p.productId === value);
            newItems[index] = { ...item, productId: value, name: product?.name || '', price: product?.price || 0, minPrice: product?.minPrice, maxPrice: product?.maxPrice, quantity: 1 };
        } else {
             newItems[index].quantity = Number(value);
        }
        setCart(newItems);
    }

    useEffect(() => {
        const quantitiesInCart = cart.reduce((acc, item) => {
            if (item.productId) {
                acc[item.productId] = (acc[item.productId] || 0) + Number(item.quantity || 0);
            }
            return acc;
        }, {} as Record<string, number>);

        const newStockErrors: Record<string, string> = {};
        for (const productId in quantitiesInCart) {
            const productStock = remainingItems.find(p => p.productId === productId)?.quantity || 0;
            if (quantitiesInCart[productId] > productStock) {
                newStockErrors[productId] = `Total quantity exceeds available stock of ${productStock}.`;
            }
        }
        setStockErrors(newStockErrors);
    }, [cart, remainingItems]);
    
    const handleAddItem = () => {
        setCart(prev => [...prev, { productId: '', name: '', quantity: 1, price: 0 } as OrderItem]);
    }

    const handleRemoveItem = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    }

    useEffect(() => {
        if (customerType === 'walk-in') {
            setSelectedCustomerId('walk-in');
            if(paymentMethod === 'Credit') setPaymentMethod('Cash');
        } else {
             setSelectedCustomerId('');
        }
    }, [customerType, paymentMethod]);


    const onCustomerCreated = (newCustomer: Customer) => {
        fetchCustomers();
        setCustomerType('registered');
        setSelectedCustomerId(newCustomer.id);
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const hasErrors = Object.keys(priceErrors).length > 0 || Object.keys(stockErrors).length > 0;
    
    const handleSubmit = async () => {
        if (!user || hasErrors || cart.some(item => !item.productId || item.quantity <= 0) || (paymentMethod === 'Credit' && selectedCustomerId === 'walk-in')) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fix all errors and fill required fields.' });
            return;
        }

        setIsLoading(true);
        const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
        const saleData = {
            runId: run.id,
            items: cart.map(item => ({...item, productId: item.productId || '' })),
            customerId: selectedCustomerId,
            customerName: customerType === 'walk-in' ? (customerName || 'Walk-in') : (selectedCustomer?.name || 'Registered Customer'),
            paymentMethod,
            staffId: user.staff_id,
            total,
        };
        const result = await handleSellToCustomer(saleData);

        if (result.success && result.orderId) {
            toast({ title: 'Pending Approval', description: 'Custom sale has been submitted for accountant approval.' });
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="w-full" disabled={run.status !== 'active'}>
                    <FileSignature className="mr-2 h-5 w-5"/>
                    <span>Log Custom Sale</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Log Custom Price Sale</DialogTitle>
                    <DialogDescription>Sell items at a custom price. This will require approval from an accountant.</DialogDescription>
                </DialogHeader>
                 <div className="py-4 space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Customer</Label>
                            <div className="flex items-center gap-2">
                                <ShadSelect value={customerType} onValueChange={(v) => setCustomerType(v as any)}>
                                    <ShadSelectTrigger><ShadSelectValue/></ShadSelectTrigger>
                                    <ShadSelectContent>
                                        <ShadSelectItem value="walk-in">Walk-in</ShadSelectItem>
                                        <ShadSelectItem value="registered">Registered</ShadSelectItem>
                                    </ShadSelectContent>
                                </ShadSelect>
                                <CreateCustomerDialog onCustomerCreated={onCustomerCreated}>
                                    <Button variant="outline" size="sm">New Customer</Button>
                                </CreateCustomerDialog>
                            </div>
                        </div>
                        {customerType === 'registered' ? (
                            <div className="space-y-2">
                                <Label>Select Customer</Label>
                                <ShadSelect value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                                    <ShadSelectTrigger><ShadSelectValue placeholder="Select a customer..." /></ShadSelectTrigger>
                                    <ShadSelectContent>
                                        {customers.map(c => <ShadSelectItem key={c.id} value={c.id}>{c.name}</ShadSelectItem>)}
                                    </ShadSelectContent>
                                </ShadSelect>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Customer Name</Label>
                                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in Customer Name"/>
                             </div>
                        )}
                    </div>
                     <div className="space-y-2">
                        <h4 className="font-semibold">Items</h4>
                         <div className="border rounded-md p-2 space-y-4 max-h-60 overflow-y-auto">
                            {cart.length === 0 ? <p className="text-center text-muted-foreground text-sm p-4">Cart is empty</p> : (
                                 cart.map((item, index) => {
                                    const product = remainingItems.find(p => p.productId === item.productId);
                                    const stockError = stockErrors[item.productId];
                                    return (
                                    <div key={`cart-item-${index}`} className="space-y-2 border-b pb-2 last:border-b-0">
                                        <div className="flex justify-between items-start">
                                            <ShadSelect value={item.productId} onValueChange={(val) => handleItemChange(index, 'productId', val)}>
                                                <ShadSelectTrigger className="w-2/3"><ShadSelectValue placeholder="Select Product" /></ShadSelectTrigger>
                                                <ShadSelectContent>
                                                    {remainingItems.map(p => (
                                                        <ShadSelectItem key={p.productId} value={p.productId}>{p.name} (Avail: {p.quantity})</ShadSelectItem>
                                                    ))}
                                                </ShadSelectContent>
                                            </ShadSelect>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} placeholder="Qty" className={stockError ? 'border-destructive' : ''}/>
                                            <Input type="number" value={item.price} onChange={e => handlePriceChange(item.productId, e.target.value)} className={priceErrors[item.productId] ? 'border-destructive' : ''} placeholder="Price per item" />
                                        </div>
                                        {priceErrors[item.productId] && <p className="text-xs text-destructive">{priceErrors[item.productId]}</p>}
                                        {stockError && !priceErrors[item.productId] && <p className="text-xs text-destructive">{stockError}</p>}
                                        <p className="text-xs text-muted-foreground">Standard Price: {formatCurrency(product?.price)}, Range: {formatCurrency(product?.minPrice)} - {formatCurrency(product?.maxPrice)}</p>
                                    </div>
                                    )
                                })
                            )}
                        </div>
                        <Button variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="mr-2 h-4 w-4"/>Add Item</Button>
                    </div>
                    <div className="font-bold text-right">Total: {formatCurrency(total)}</div>
                     <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <ShadSelect onValueChange={(value) => setPaymentMethod(value as any)} defaultValue={paymentMethod}>
                            <ShadSelectTrigger><ShadSelectValue/></ShadSelectTrigger>
                            <ShadSelectContent>
                                <ShadSelectItem value="Cash"><Wallet className="mr-2 h-4 w-4"/> Cash</ShadSelectItem>
                                <ShadSelectItem value="POS"><SquareTerminal className="mr-2 h-4 w-4"/> POS</ShadSelectItem>
                                <ShadSelectItem value="Credit" disabled={customerType === 'walk-in'}><CreditCard className="mr-2 h-4 w-4"/> Credit</ShadSelectItem>
                            </ShadSelectContent>
                        </ShadSelect>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isLoading || hasErrors}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit for Approval
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function LogExpenseDialog({ run, user }: { run: SalesRun, user: User | null }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState<number | string>('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!amount || !description || !category || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all fields.' });
            return;
        }

        setIsSubmitting(true);
        const result = await logRunExpense({
            runId: run.id,
            driverId: user.staff_id,
            driverName: user.name,
            amount: Number(amount),
            category,
            description,
        });

        if (result.success) {
            toast({ title: 'Expense Submitted', description: 'Your expense has been sent for approval.' });
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline" className="w-full" disabled={run.status !== 'active'}>
                    <Fuel className="mr-2 h-5 w-5"/>
                    <span>Log Run Expense</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Log Run Expense</DialogTitle>
                    <DialogDescription>Record an expense incurred during this sales run. It will be submitted for approval.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="expense-category">Expense Category</Label>
                        <ShadSelect value={category} onValueChange={setCategory}>
                            <ShadSelectTrigger><ShadSelectValue placeholder="Select a category..."/></ShadSelectTrigger>
                            <ShadSelectContent>
                                <ShadSelectItem value="Fuel">Fuel</ShadSelectItem>
                                <ShadSelectItem value="Toll">Toll / Levies</ShadSelectItem>
                                <ShadSelectItem value="Vehicle-Repairs">Vehicle Repairs</ShadSelectItem>
                                <ShadSelectItem value="Other">Other</ShadSelectItem>
                            </ShadSelectContent>
                        </ShadSelect>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="expense-description">Description</Label>
                        <Textarea id="expense-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Bought 10L of petrol at XYZ station"/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="expense-amount">Amount (₦)</Label>
                        <Input id="expense-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Submit for Approval
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ReportWasteDialog({ run, user, onWasteReported, remainingItems }: { run: SalesRun, user: User, onWasteReported: () => void, remainingItems: { productId: string; name: string; price: number; quantity: number }[] }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState<{ productId: string, quantity: number | string }[]>([{ productId: '', quantity: 1 }]);
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if(isOpen) {
            setItems([{ productId: '', quantity: 1 }]);
            setReason('');
            setNotes('');
        }
    }, [isOpen]);

    const handleItemChange = (index: number, field: 'productId' | 'quantity', value: string) => {
        const newItems = [...items];
        if (field === 'quantity') {
            const numValue = Number(value);
            const productInfo = remainingItems.find(p => p.productId === newItems[index].productId);
            if (productInfo && numValue > productInfo.quantity) {
                toast({ variant: 'destructive', title: 'Error', description: `Cannot report more than ${productInfo.quantity} units of waste for this item.` });
                newItems[index][field] = productInfo.quantity;
            } else {
                newItems[index][field] = value === '' ? '' : numValue;
            }
        } else {
            newItems[index][field] = value;
        }
        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { productId: '', quantity: 1 }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (items.some(item => !item.productId || !item.quantity || Number(item.quantity) <= 0) || !reason) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all product and reason fields correctly.' });
            return;
        }

        setIsSubmitting(true);
        const productsWithCategories = await Promise.all(items.map(async item => {
            const productDoc = await getDoc(doc(db, 'products', item.productId));
            return {
                ...item,
                quantity: Number(item.quantity),
                productName: productDoc.exists() ? productDoc.data().name : 'Unknown',
                productCategory: productDoc.exists() ? productDoc.data().category : 'Unknown'
            };
        }));

        const dataToSubmit = {
            items: productsWithCategories,
            reason,
            notes,
        };

        const result = await handleReportWaste(dataToSubmit, user);

        if (result.success) {
            toast({ title: 'Success', description: 'Waste reported successfully. Your inventory has been updated.' });
            onWasteReported();
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    };

    const getAvailableProductsForRow = (rowIndex: number) => {
        const selectedIdsInOtherRows = new Set(
            items.filter((_, i) => i !== rowIndex).map(item => item.productId)
        );
        return remainingItems.filter(p => !selectedIdsInOtherRows.has(p.productId));
    };

    return (
       <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="w-full" disabled={run.status !== 'active' || remainingItems.length === 0}>
                    <Trash className="mr-2 h-5 w-5"/>
                    <span>Report Waste</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Report Spoiled or Damaged Stock</DialogTitle>
                    <DialogDescription>
                        Select items from this sales run that are no longer sellable. This will deduct them from your personal inventory.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Items to Report</Label>
                        <div className="space-y-2">
                            {items.map((item, index) => {
                                const availableProducts = getAvailableProductsForRow(index);
                                return (
                                    <div key={`waste-item-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                                        <ShadSelect value={item.productId} onValueChange={(val) => handleItemChange(index, 'productId', val)}>
                                            <ShadSelectTrigger><ShadSelectValue placeholder="Select a product" /></ShadSelectTrigger>
                                            <ShadSelectContent>
                                                {availableProducts.map((p) => (
                                                    <ShadSelectItem key={`${p.productId}-${index}`} value={p.productId}>
                                                        {p.name} (Avail: {p.quantity})
                                                    </ShadSelectItem>
                                                ))}
                                            </ShadSelectContent>
                                        </ShadSelect>
                                        <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                )
                            })}
                        </div>
                        <Button variant="outline" size="sm" className="mt-2" onClick={handleAddItem}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Another Item
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="waste-reason">Reason for Waste</Label>
                        <ShadSelect value={reason} onValueChange={setReason}>
                            <ShadSelectTrigger id="waste-reason">
                                <ShadSelectValue placeholder="Select a reason" />
                            </ShadSelectTrigger>
                            <ShadSelectContent>
                            <ShadSelectItem value="Spoiled">Spoiled / Expired</ShadSelectItem>
                            <ShadSelectItem value="Damaged">Damaged</ShadSelectItem>
                            <ShadSelectItem value="Error">Error (Mistake)</ShadSelectItem>
                            <ShadSelectItem value="Other">Other</ShadSelectItem>
                            </ShadSelectContent>
                        </ShadSelect>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="waste-notes">Additional Notes (Optional)</Label>
                        <Input id="waste-notes" value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Submit Report
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RecordPaymentDialog({ customer, run, user }: { customer: RunCustomer | null, run: SalesRun, user: User | null }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState<number | string>('');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'POS'>('Cash');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customers, setCustomers] = useState<RunCustomer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<RunCustomer | null>(customer);
    const [customerEmail, setCustomerEmail] = useState('');

    useEffect(() => {
        if (isOpen) {
            getCustomersForRun(run.id).then(setCustomers);
            setSelectedCustomer(customer);
            setAmount('');
        }
    }, [isOpen, run.id, customer]);

    const outstanding = selectedCustomer ? selectedCustomer.totalSold - selectedCustomer.totalPaid : 0;
    
    useEffect(() => {
        const fetchCustomerEmail = async () => {
            if (isOpen && selectedCustomer && selectedCustomer.customerId !== 'walk-in') {
                const customerDoc = await getDoc(doc(db, "customers", selectedCustomer.customerId));
                if(customerDoc.exists()) {
                    setCustomerEmail(customerDoc.data().email || '');
                }
            }
        }
        if(isOpen && selectedCustomer) {
            fetchCustomerEmail();
        }
    }, [isOpen, selectedCustomer]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            setAmount('');
            return;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        if (numValue > outstanding) {
            setAmount(outstanding);
            toast({ variant: 'destructive', title: 'Limit Exceeded', description: `Amount cannot be more than the outstanding balance of ${formatCurrency(outstanding)}` });
        } else {
            setAmount(numValue);
        }
    };


    const handleRecordPayment = async () => {
        if (!user || !run || !selectedCustomer) return;
        const paymentAmount = Number(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid amount.' });
            return;
        }
        if (paymentAmount > outstanding) {
            toast({ variant: 'destructive', title: 'Error', description: `Payment cannot exceed outstanding balance of ₦${outstanding.toLocaleString()}.` });
            return;
        }

        setIsSubmitting(true);
        
        const result = await handleRecordDebtPaymentForRun({
            runId: run.id,
            customerId: selectedCustomer.customerId,
            customerName: selectedCustomer.customerName,
            driverId: run.to_staff_id,
            driverName: run.to_staff_name || 'Unknown Driver',
            amount: paymentAmount,
            paymentMethod,
        });

        if (result.success) {
            toast({ title: 'Success', description: 'Debt payment recorded for approval.' });
            setAmount('');
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        
        setIsSubmitting(false);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline" className="w-full" disabled={run.status !== 'active'}>
                    <HandCoins className="mr-2 h-5 w-5"/>
                    <span>Record Debt Payment</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Debt Payment</DialogTitle>
                    <DialogDescription>
                        Record a payment received from a customer for an outstanding debt.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Customer</Label>
                        <ShadSelect
                            value={selectedCustomer?.customerId}
                            onValueChange={(customerId) => setSelectedCustomer(customers.find(c => c.customerId === customerId) || null)}
                        >
                            <ShadSelectTrigger><ShadSelectValue placeholder="Select a customer with debt..."/></ShadSelectTrigger>
                            <ShadSelectContent>
                                {customers.filter(c => (c.totalSold - c.totalPaid) > 0).map(c => (
                                    <ShadSelectItem key={c.customerId} value={c.customerId}>
                                        {c.customerName} (Owes {formatCurrency(c.totalSold - c.totalPaid)})
                                    </ShadSelectItem>
                                ))}
                            </ShadSelectContent>
                        </ShadSelect>
                    </div>
                    {selectedCustomer && (
                        <>
                            <div className="space-y-2">
                                <Label>Payment Method</Label>
                                <ShadSelect value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                                    <ShadSelectTrigger><ShadSelectValue/></ShadSelectTrigger>
                                    <ShadSelectContent>
                                        <ShadSelectItem value="Cash">Cash</ShadSelectItem>
                                        <ShadSelectItem value="POS">POS</ShadSelectItem>
                                    </ShadSelectContent>
                                </ShadSelect>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="payment-amount">Amount Paid (₦)</Label>
                                <Input id="payment-amount" type="number" value={amount} onChange={handleAmountChange} />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleRecordPayment} disabled={isSubmitting || !selectedCustomer}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit for Approval
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ReturnStockDialog({ run, user, onReturn, remainingItems }: { run: SalesRun, user: User, onReturn: () => void, remainingItems: OrderItem[] }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [itemsToReturn, setItemsToReturn] = useState<Record<string, number | string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [returnTo, setReturnTo] = useState('');
    const [staffList, setStaffList] = useState<StaffMember[]>([]);

    useEffect(() => {
        if (isOpen) {
            getStaffList().then(list => {
                const isDeliveryStaff = user.role === 'Delivery Staff';
                const isShowroomStaff = user.role === 'Showroom Staff';
                
                const filteredStaff = list.filter(s => {
                    if (isDeliveryStaff) {
                        return s.role === 'Storekeeper' || s.role === 'Showroom Staff';
                    }
                    if (isShowroomStaff) {
                        return s.role === 'Storekeeper' || s.role === 'Delivery Staff';
                    }
                    return false;
                }).filter(s => s.id !== user.staff_id);
                setStaffList(filteredStaff);
            });
            setItemsToReturn({});
            setReturnTo('');
        }
    }, [isOpen, user.role, user.staff_id]);

    const handleQuantityChange = (productId: string, value: string, maxStock: number) => {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 0) {
            setItemsToReturn(prev => ({...prev, [productId]: ''}));
            return;
        }

        if (numValue > maxStock) {
            toast({ variant: 'destructive', title: 'Error', description: `Cannot return more than the available ${maxStock} units.`});
            setItemsToReturn(prev => ({...prev, [productId]: maxStock}));
        } else {
            setItemsToReturn(prev => ({...prev, [productId]: numValue}));
        }
    };
    
    const handleSubmit = async () => {
        const items = Object.entries(itemsToReturn)
            .map(([id, quantity]) => {
                const stockItem = remainingItems.find(p => p.productId === id);
                return {
                    productId: id,
                    productName: stockItem?.name || 'Unknown',
                    quantity: Number(quantity),
                };
            })
            .filter(item => item.quantity > 0);

        if (items.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a quantity for at least one item.' });
            return;
        }
        
        if (!returnTo) {
             toast({ variant: 'destructive', title: 'Error', description: 'Please select a staff member to return the stock to.' });
            return;
        }

        setIsSubmitting(true);
        const result = await handleReturnStock(run.id, items, user, returnTo);
        
        if (result.success) {
            toast({ title: 'Success', description: 'Stock return request submitted for approval.' });
            onReturn();
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="w-full">
                    <Undo2 className="mr-2 h-4 w-4" /> Return Unsold Stock
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Return Unsold Stock</DialogTitle>
                    <DialogDescription>Enter quantities for products you want to return.</DialogDescription>
                </DialogHeader>
                <div className="py-4 max-h-96 overflow-y-auto space-y-4">
                    <div className="space-y-2">
                        <Label>Return to</Label>
                        <ShadSelect value={returnTo} onValueChange={setReturnTo}>
                            <ShadSelectTrigger><ShadSelectValue placeholder="Select staff to return to..." /></ShadSelectTrigger>
                            <ShadSelectContent>
                                {staffList.map(s => (
                                    <ShadSelectItem key={s.id} value={s.id}>{s.name} ({s.role})</ShadSelectItem>
                                ))}
                            </ShadSelectContent>
                        </ShadSelect>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-center">Available</TableHead>
                                <TableHead className="text-right">Quantity to Return</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {remainingItems.map(item => (
                                <TableRow key={item.productId}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                    <TableCell className="text-right">
                                        <Input
                                            type="number"
                                            className="w-24 h-8 text-right ml-auto"
                                            placeholder="0"
                                            value={itemsToReturn[item.productId] || ''}
                                            onChange={(e) => handleQuantityChange(item.productId, e.target.value, item.quantity)}
                                            max={item.quantity}
                                            min={0}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !returnTo}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Submit Return Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function CustomerOrdersDialog({ isOpen, onOpenChange, customer, orders }: { isOpen: boolean, onOpenChange: (open: boolean) => void, customer: RunCustomer | null, orders: CompletedOrder[] }) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [ordersToPrint, setOrdersToPrint] = useState<CompletedOrder[]>([]);
    const [viewingOrder, setViewingOrder] = useState<CompletedOrder | null>(null);

    const customerOrders = useMemo(() => {
        if (!customer) return [];
        return orders.filter(order => order.customerName === customer.customerName);
    }, [customer, orders]);

    useEffect(() => {
        if (ordersToPrint.length > 0 && receiptRef.current) {
            handlePrint(receiptRef.current);
            setOrdersToPrint([]);
        }
    }, [ordersToPrint]);
    
    if (!customer) return null;

    const handlePrintAll = () => {
        setOrdersToPrint(customerOrders);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Order History for {customer.customerName}</DialogTitle>
                        <DialogDescription>Showing all orders for this customer within this sales run.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customerOrders.length > 0 ? customerOrders.map(order => (
                                    <TableRow key={order.id} onClick={() => setViewingOrder(order)} className="cursor-pointer">
                                        <TableCell>{format(new Date(order.date), 'Pp')}</TableCell>
                                        <TableCell>{order.items.reduce((sum, i) => sum + i.quantity, 0)}</TableCell>
                                        <TableCell><Badge variant="secondary">{order.paymentMethod}</Badge></TableCell>
                                        <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">No orders found for this customer.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter className="justify-between">
                         <Button variant="outline" onClick={handlePrintAll} disabled={customerOrders.length === 0}>
                            <Printer className="mr-2 h-4 w-4"/> Print Receipts
                        </Button>
                        <Button onClick={() => onOpenChange(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Order Details</DialogTitle>
                        <DialogDescription>
                            Receipt for order {viewingOrder?.id.substring(0,8)}...
                        </DialogDescription>
                    </DialogHeader>
                    {viewingOrder && <Receipt order={viewingOrder} />}
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setViewingOrder(null)}>Close</Button>
                        <Button onClick={() => handlePrint(receiptRef.current)}><Printer className="mr-2 h-4 w-4" />Print</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="hidden">
                <div ref={receiptRef}>
                    {ordersToPrint.length > 0 && ordersToPrint.map((order, index) => (
                        <div key={order.id} className={index > 0 ? "page-break-before-always" : ""}>
                             <Receipt order={order} />
                        </div>
                    ))}
                    {viewingOrder && <Receipt order={viewingOrder} />}
                </div>
            </div>
        </>
    )
}

export function SalesRunDetailsPageClient({ initialRun }: { initialRun: SalesRun }) {
    const { runId } = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [run, setRun] = useState<SalesRun | null>(initialRun);
    const [orders, setOrders] = useState<CompletedOrder[]>([]);
    const [customers, setCustomers] = useState<RunCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [viewingOrder, setViewingOrder] = useState<CompletedOrder | null>(null);
    const [viewingCustomer, setViewingCustomer] = useState<RunCustomer | null>(null);
    const summaryReceiptRef = useRef<HTMLDivElement>(null);
    const [paymentConfirmations, setPaymentConfirmations] = useState<any[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'outstanding', direction: 'desc' });
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [allProducts, setAllProducts] = useState<Product[]>([]);

    const fetchRunData = useCallback(async () => {
        if (!runId) return;
        setIsLoading(true);
        const runDetails = await getSalesRunDetails(runId as string);
        setRun(runDetails);
        setIsLoading(false);
    }, [runId]);

    useEffect(() => {
        let unsubRun: (() => void) | undefined;
        let unsubOrders: (() => void) | undefined;
        let unsubPayments: (() => void) | undefined;
        
        const userJSON = localStorage.getItem('loggedInUser');
        if (userJSON) {
            setUser(JSON.parse(userJSON));
        }
        getProducts().then(setAllProducts);

        if (runId) {
            getSalesRunDetails(runId as string).then(initialRun => {
                setRun(initialRun);
                if (isLoading) setIsLoading(false);
            });
            
            const runDocRef = doc(db, "transfers", runId as string);
            unsubRun = onSnapshot(runDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    getSalesRunDetails(runId as string).then(setRun);
                } else {
                    setRun(null);
                }
            });

            const ordersQuery = query(collection(db, 'orders'), where('salesRunId', '==', runId as string));
            unsubOrders = onSnapshot(ordersQuery, async () => {
                const [customerDetails, orderDetails] = await Promise.all([
                    getCustomersForRun(runId as string),
                    getOrdersForRun(runId as string)
                ]);
                setCustomers(customerDetails);
                setOrders(orderDetails.map(o => ({...o, date: new Date(o.date)})));
            });

            unsubPayments = onSnapshot(query(collection(db, 'payment_confirmations'), where('runId', '==', runId as string), where('status', '==', 'pending')), (snapshot) => {
                setPaymentConfirmations(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
            });
        }
        
        return () => {
            unsubRun?.();
            unsubOrders?.();
            unsubPayments?.();
        };
    }, [runId, isLoading]);
    
    const handleCompleteRunAction = async () => {
        if (!run) return;
        const result = await handleCompleteRun(run.id);
        if (result.success) {
            toast({ title: 'Success!', description: 'Sales run has been completed and stock reconciled.'});
            router.push('/dashboard/deliveries');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    }
    
    const totalCollected = useMemo(() => run?.totalCollected || 0, [run]);
    const runStatus = useMemo(() => run?.status || 'inactive', [run]);

    const sortedCustomers = useMemo(() => {
        const customersWithOutstanding = customers.map(c => ({
            ...c,
            outstanding: c.totalSold - c.totalPaid
        }));

        return [...customersWithOutstanding].sort((a, b) => {
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) {
                return direction === 'asc' ? -1 : 1;
            }
            if (a[key] > b[key]) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [customers, sortConfig]);

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    };
    
    const handleSaleMade = (newOrder: CompletedOrder) => {
        if (newOrder.paymentMethod === 'Paystack') {
            setViewingOrder(newOrder);
        }
    }
    
     const getRemainingItems = useCallback(() => {
        if (!run || !run.items) return [];

        const soldQuantities: { [key: string]: number } = {};
        if (Array.isArray(orders)) {
            orders.forEach(order => {
                if (Array.isArray(order.items)) {
                    order.items.forEach(item => {
                        soldQuantities[item.productId] = (soldQuantities[item.productId] || 0) + item.quantity;
                    });
                }
            });
        }
        
        return run.items.map(item => {
            const soldQuantity = soldQuantities[item.productId] || 0;
            const remainingQuantity = item.quantity - soldQuantity;
            return {
                ...item,
                price: item.price || 0,
                name: item.productName,
                quantity: remainingQuantity > 0 ? remainingQuantity : 0,
            };
        }).filter(item => item.quantity > 0);
    }, [run, orders]);
    
    const { progressValue, progressDenominator } = useMemo(() => {
        if (!run) return { progressValue: 0, progressDenominator: 1 };
        
        if (run.status === 'pending_return' || run.status === 'return_completed') {
            const totalSoldValue = orders.reduce((sum, order) => sum + order.total, 0);
            return {
                progressValue: totalCollected,
                progressDenominator: totalSoldValue > 0 ? totalSoldValue : 1,
            };
        }
        
        return {
            progressValue: totalCollected,
            progressDenominator: run.totalRevenue || 1
        };

    }, [run, orders, totalCollected]);


    const remainingItems = useMemo(getRemainingItems, [getRemainingItems]);
    const productCategories = useMemo(() => ['All', ...new Set(allProducts.map(p => p.category))], [allProducts]);
    
    if (isLoading || !run || !user) {
        return (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const runComplete = runStatus === 'completed' || run.status === 'return_completed';
    const isPendingReturn = runStatus === 'pending_return';
    const canPerformActions = user?.staff_id === run?.to_staff_id;
    const canPerformSales = canPerformActions && !runComplete && !isPendingReturn;
    const canReturnStock = canPerformActions && (run.status === 'active' || isPendingReturn);
    const isReadOnly = user?.role === 'Manager';
    const allDebtsPaid = run.totalOutstanding <= 0;
    
    return (
        <div className="flex flex-col gap-6">
             <ProductEditDialog 
                product={editingProduct}
                onOpenChange={() => setEditingProduct(null)}
                onProductUpdate={fetchRunData}
                user={user}
                categories={productCategories}
             />
            <div className="flex items-center justify-between">
                <Link href="/dashboard/deliveries" className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to Deliveries</Link>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchRunData()} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrint(summaryReceiptRef.current)}>
                        <Printer className={`mr-2 h-4 w-4`} /> Print Run Summary
                    </Button>
                 </div>
            </div>
             <div ref={summaryReceiptRef} className="hidden print:block">
                 <div className="receipt-container p-4">
                    <div className="text-center">
                        <div className="font-bold text-2xl">BMS</div>
                        <div className="text-sm text-muted-foreground">Sales Run Summary</div>
                    </div>
                    <hr className="my-2" />
                     <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                            <span>Run ID:</span>
                            <span>{run.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Start Time:</span>
                            <span>{run.date ? format(new Date(run.date), 'Pp') : 'N/A'}</span>
                        </div>
                         <div className="flex justify-between">
                            <span>Driver:</span>
                            <span>{run.to_staff_name}</span>
                        </div>
                    </div>
                    <hr className="my-2" />
                    <h3 className="font-bold text-center text-sm mb-1">Stock Summary</h3>
                    <Table>
                        <TableHeader><TableRow><TableHead className="h-auto p-1 text-xs">Item</TableHead><TableHead className="text-right h-auto p-1 text-xs">Initial</TableHead><TableHead className="text-right h-auto p-1 text-xs">Sold</TableHead><TableHead className="text-right h-auto p-1 text-xs">Left</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {run.items.map(item => {
                                const sold = item.quantity - (remainingItems.find(i => i.productId === item.productId)?.quantity || 0);
                                return <TableRow key={item.productId}><TableCell className="p-1 text-xs">{item.productName}</TableCell><TableCell className="text-right p-1 text-xs">{item.quantity}</TableCell><TableCell className="text-right p-1 text-xs">{sold}</TableCell><TableCell className="text-right p-1 text-xs">{item.quantity - sold}</TableCell></TableRow>
                            })}
                        </TableBody>
                    </Table>
                    <hr className="my-2" />
                     <h3 className="font-bold text-center text-sm mb-1">Financial Summary</h3>
                     <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                            <span>Total Value:</span>
                            <span className="font-bold">{formatCurrency(run.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total Collected:</span>
                            <span className="font-bold">{formatCurrency(totalCollected)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total Outstanding:</span>
                            <span className="font-bold">{formatCurrency(run.totalOutstanding)}</span>
                        </div>
                    </div>
                    <hr className="my-2" />
                     <div className="text-xs text-muted-foreground text-center">Printed on {format(new Date(), 'Pp')}</div>
                </div>
             </div>

            <h1 className="text-2xl font-bold font-headline">Sales Run: {(runId as string).substring(0,8)}...</h1>
             {runComplete && <Badge variant="outline">Completed</Badge>}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Run Summary</CardTitle>
                        <CardDescription>Overview of this sales run.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between"><span>Status:</span> <Badge>{runStatus}</Badge></div>
                        <div className="flex justify-between"><span>Start Time:</span> <span>{run.date ? format(new Date(run.date), 'PPP') : 'N/A'}</span></div>
                         <div className="flex justify-between"><span>Driver:</span> <span>{run.to_staff_name}</span></div>
                        <div><Progress value={(progressValue / progressDenominator) * 100} /></div>
                        <div className="text-sm text-muted-foreground">Collection Progress ({formatCurrency(progressValue)} / {formatCurrency(progressDenominator)})</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sales Performance</CardTitle>
                        <CardDescription>Key metrics from this run.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between"><span>Total Revenue:</span> <span>₦{run.totalRevenue.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Total Collected:</span> <span>₦{totalCollected.toLocaleString()}</span></div>
                         <div className="flex justify-between"><span>Outstanding Debt:</span> <span>₦{(run.totalOutstanding).toLocaleString()}</span></div>
                    </CardContent>
                </Card>

                 <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Actions</CardTitle>
                        <CardDescription>Manage this sales run.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow grid grid-cols-2 gap-2">
                        <SellToCustomerDialog run={run} user={user} onSaleMade={handleSaleMade} remainingItems={remainingItems}/>
                        <RecordPaymentDialog customer={null} run={run} user={user} />
                        <LogCustomSaleDialog run={run} user={user} onSaleMade={handleSaleMade} remainingItems={remainingItems} />
                        <LogExpenseDialog run={run} user={user} />
                        <ReportWasteDialog run={run} user={user} onWasteReported={fetchRunData} remainingItems={remainingItems} />
                        {canReturnStock && <ReturnStockDialog user={user} onReturn={fetchRunData} remainingItems={remainingItems} />}
                    </CardContent>
                    {canPerformActions && (
                        <CardFooter className="flex-col gap-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button disabled={runComplete || !allDebtsPaid || remainingItems.length > 0} className="w-full">
                                        <CheckCircle className="mr-2 h-4 w-4"/> Complete Run
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                     <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will complete the sales run. All stock and finances will be reconciled. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader
                                    ><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleCompleteRunAction}>Yes, Complete Run</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                     )}
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Stock for this Run</CardTitle>
                    <CardDescription>Initial stock and remaining items for this sales run.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Initial Qty</TableHead>
                                <TableHead className="text-right">Sold</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                                {user?.role === 'Developer' && <TableHead className="text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {run.items.map(item => {
                                const soldQuantity = orders.flatMap(o => o.items).filter(i => i.productId === item.productId).reduce((sum, i) => sum + i.quantity, 0);
                                const remaining = item.quantity - soldQuantity;
                                const fullProduct = allProducts.find(p => p.id === item.productId);
                                return (
                                    <TableRow key={item.productId}>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{soldQuantity}</TableCell>
                                        <TableCell className="text-right font-bold">{remaining}</TableCell>
                                        {user?.role === 'Developer' && (
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => setEditingProduct(fullProduct!)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Tabs defaultValue="customers" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="customers">Customers</TabsTrigger>
                    <TabsTrigger value="sales">Sales</TabsTrigger>
                     <TabsTrigger value="expenses">Expenses</TabsTrigger>
                    <TabsTrigger value="pending" className="relative">
                        Pending Confirmations
                        {paymentConfirmations.length > 0 && <Badge variant="destructive" className="ml-2">{paymentConfirmations.length}</Badge>}
                    </TabsTrigger>
                </TabsList>
                 <TabsContent value="customers">
                    <Card>
                        <CardHeader>
                            <CardTitle>Customers</CardTitle>
                            <CardDescription>All customers in this run. Click headers to sort.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="md:hidden space-y-4">
                                {sortedCustomers.map(customer => {
                                    const outstanding = customer.totalSold - customer.totalPaid;
                                    return (
                                        <Card key={customer.customerId} className="p-4 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold">{customer.customerName}</p>
                                                <Button variant="ghost" size="sm" onClick={() => setViewingCustomer(customer)}>View Orders</Button>
                                            </div>
                                            <div className="text-sm pt-2 border-t space-y-1">
                                                <div className="flex justify-between"><span>Sold:</span><span>{formatCurrency(customer.totalSold)}</span></div>
                                                <div className="flex justify-between"><span>Paid:</span><span className="text-green-500">{formatCurrency(customer.totalPaid)}</span></div>
                                                <div className="flex justify-between font-bold"><span>Owed:</span><span className="text-destructive">{formatCurrency(outstanding)}</span></div>
                                            </div>
                                             {canPerformActions && !runComplete && outstanding > 0 && (
                                                <div className="pt-2 border-t">
                                                    <RecordPaymentDialog customer={customer} run={run} user={user} />
                                                </div>
                                            )}
                                        </Card>
                                    )
                                })}
                            </div>
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('totalSold')}>
                                                <div className="flex items-center justify-end">Total Sold {getSortIcon('totalSold')}</div>
                                            </TableHead>
                                            <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('totalPaid')}>
                                                <div className="flex items-center justify-end">Total Paid {getSortIcon('totalPaid')}</div>
                                            </TableHead>
                                            <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('outstanding')}>
                                                <div className="flex items-center justify-end">Outstanding {getSortIcon('outstanding')}</div>
                                            </TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedCustomers.map(customer => {
                                            const outstanding = customer.totalSold - customer.totalPaid;
                                            return (
                                                <TableRow key={customer.customerId} onClick={() => setViewingCustomer(customer)} className="cursor-pointer">
                                                    <TableCell>{customer.customerName}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(customer.totalSold)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(customer.totalPaid || 0)}</TableCell>
                                                    <TableCell className="text-right font-bold text-destructive">
                                                        {outstanding > 0 ? formatCurrency(outstanding) : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                        {(canPerformActions && !runComplete && outstanding > 0) ? (
                                                            <RecordPaymentDialog customer={customer} run={run} user={user} />
                                                        ) : (
                                                            <Button size="sm" variant="outline" disabled>Record Payment</Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="sales">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sales</CardTitle>
                            <CardDescription>All sales made in this run.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="md:hidden space-y-4">
                                {orders.map(order => (
                                     <Card key={order.id} className="p-4 space-y-2" onClick={() => setViewingOrder(order)}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{order.customerName}</p>
                                                <p className="text-xs text-muted-foreground">{format(new Date(order.date), 'Pp')}</p>
                                            </div>
                                            <Badge variant="secondary">{order.paymentMethod}</Badge>
                                        </div>
                                         <div className="text-sm pt-2 border-t flex justify-between">
                                            <span>{order.items.reduce((sum, i) => sum + i.quantity, 0)} items</span>
                                            <span className="font-bold">{formatCurrency(order.total)}</span>
                                        </div>
                                     </Card>
                                ))}
                            </div>
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead>Payment Method</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orders.map(order => (
                                            <TableRow key={order.id} className="cursor-pointer" onClick={() => setViewingOrder(order)}>
                                                <TableCell>{format(new Date(order.date), 'Pp')}</TableCell>
                                                <TableCell>{order.customerName}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                                                <TableCell>{order.paymentMethod}</TableCell>
                                                <TableCell className="text-right"><Button variant="ghost" size="sm">View</Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="expenses">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div>
                                <CardTitle>Run Expenses</CardTitle>
                                <CardDescription>Log and view expenses specific to this sales run.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                 <TableBody>
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No expenses logged for this run yet.
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="pending">
                     <Card>
                        <CardHeader>
                            <CardTitle>Pending Confirmations</CardTitle>
                            <CardDescription>Cash payments awaiting accountant approval.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paymentConfirmations.map(order => (
                                        <TableRow key={order.id}>
                                            <TableCell>{order.date ? format(order.date.toDate(), 'PPP') : 'N/A'}</TableCell>
                                            <TableCell>{order.customerName}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(order.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            
            <CustomerOrdersDialog isOpen={!!viewingCustomer} onOpenChange={() => setViewingCustomer(null)} customer={viewingCustomer} orders={orders} />

            <Dialog open={!!viewingOrder} onOpenChange={(isOpen) => !isOpen && setViewingOrder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Order Details</DialogTitle>
                        <DialogDescription>
                            Receipt for order {viewingOrder?.id.substring(0,8)}...
                        </DialogDescription>
                    </DialogHeader>
                    {viewingOrder && <Receipt order={viewingOrder} />}
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setViewingOrder(null)}>Close</Button>
                        <Button onClick={() => handlePrint(receiptRef.current)}><Printer className="mr-2 h-4 w-4" />Print</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

    