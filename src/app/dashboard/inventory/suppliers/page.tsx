

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
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
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, PlusCircle, Loader2, Search, ArrowLeft, Wallet, ArrowRightLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where, orderBy, increment, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDirectCost, handleLogPayment, initializePaystackTransaction } from "@/app/actions";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type User = {
    name: string;
    role: string;
    staff_id: string;
    email: string;
};

type Supplier = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  amountOwed: number;
  amountPaid: number;
};

type Ingredient = {
    id: string;
    name: string;
    unit: string;
    costPerUnit: number;
}

type SupplyLog = {
    id: string;
    supplierId: string;
    supplierName: string;
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    costPerUnit: number;
    totalCost: number;
    date: any; // Can be Timestamp or string
    invoiceNumber?: string;
}

type PaymentLog = {
    id: string;
    supplierId: string;
    amount: number;
    date: any; // Can be Timestamp or string
    description: string;
}

type Transaction = {
    date: Date;
    description: string;
    debit: number | null;
    credit: number | null;
    balance: number;
}

function SupplierDialog({
  isOpen,
  onOpenChange,
  onSave,
  supplier,
  user
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Supplier, 'id'>) => void;
  supplier: Partial<Supplier> | null;
  user: User | null;
}) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [contactPerson, setContactPerson] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [amountOwed, setAmountOwed] = useState(0);
    const [amountPaid, setAmountPaid] = useState(0);

    const isDeveloper = user?.role === 'Developer';


    useEffect(() => {
        if (supplier) {
            setName(supplier.name || "");
            setContactPerson(supplier.contactPerson || "");
            setPhone(supplier.phone || "");
            setEmail(supplier.email || "");
            setAddress(supplier.address || "");
            setAmountOwed(supplier.amountOwed || 0);
            setAmountPaid(supplier.amountPaid || 0);
        } else {
            setName("");
            setContactPerson("");
            setPhone("");
            setEmail("");
            setAddress("");
            setAmountOwed(0);
            setAmountPaid(0);
        }
    }, [supplier]);

    const handleSubmit = () => {
        if (!name || !contactPerson) {
            toast({ variant: 'destructive', title: 'Error', description: 'Supplier name and contact person are required.' });
            return;
        }
        onSave({ name, contactPerson, phone, email, address, amountOwed: Number(amountOwed), amountPaid: Number(amountPaid) });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{supplier?.id ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                    <DialogDescription>
                        {supplier?.id ? 'Update the details of this supplier.' : 'Fill in the details for the new supplier.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="contactPerson" className="text-right">Contact</Label>
                        <Input id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phone" className="text-right">Phone</Label>
                        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="address" className="text-right">Address</Label>
                        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amountOwed" className="text-right">Amount Owed (₦)</Label>
                        <Input id="amountOwed" type="number" value={amountOwed} onChange={(e) => setAmountOwed(Number(e.target.value))} className="col-span-3" disabled={!isDeveloper} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amountPaid" className="text-right">Amount Paid (₦)</Label>
                        <Input id="amountPaid" type="number" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} className="col-span-3" disabled={!isDeveloper} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>{supplier?.id ? 'Save Changes' : 'Create Supplier'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SupplyLogDialog({
    isOpen,
    onOpenChange,
    onSave,
    supplier,
    ingredients,
    user
} : {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (log: Omit<SupplyLog, 'id' | 'supplierName'>, user: User) => void;
    supplier: Supplier;
    ingredients: Ingredient[];
    user: User | null;
}) {
    const [ingredientId, setIngredientId] = useState("");
    const [quantity, setQuantity] = useState(0);
    const [costPerUnit, setCostPerUnit] = useState(0);
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const { toast } = useToast();

    const selectedIngredient = useMemo(() => ingredients.find(i => i.id === ingredientId), [ingredientId, ingredients]);
    
    useEffect(() => {
        if(selectedIngredient) {
            setCostPerUnit(selectedIngredient.costPerUnit || 0);
        }
    }, [selectedIngredient]);
    
    const handleSubmit = () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not found.'});
            return;
        }
        if (!ingredientId || !quantity || !costPerUnit) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields.'});
            return;
        }
        
        const totalCost = quantity * costPerUnit;

        onSave({
            supplierId: supplier.id,
            ingredientId,
            ingredientName: selectedIngredient?.name || '',
            quantity,
            unit: selectedIngredient?.unit || '',
            costPerUnit,
            totalCost,
            date: serverTimestamp(),
            invoiceNumber
        }, user);
        onOpenChange(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Supply Log for {supplier.name}</DialogTitle>
                    <DialogDescription>Record a new delivery of ingredients from this supplier.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="ingredient">Ingredient</Label>
                        <Select value={ingredientId} onValueChange={setIngredientId}>
                            <SelectTrigger><SelectValue placeholder="Select an ingredient"/></SelectTrigger>
                            <SelectContent>
                                {ingredients.map(ing => (
                                    <SelectItem key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="quantity">Quantity Received</Label>
                        <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="costPerUnit">Cost Per Unit (₦)</Label>
                        <Input id="costPerUnit" type="number" value={costPerUnit} onChange={(e) => setCostPerUnit(Number(e.target.value))} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="invoiceNumber">Invoice Number (Optional)</Label>
                        <Input id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>Save Log & Update Stock</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function LogPaymentDialog({ supplier, user, onPaymentLogged, disabled }: { supplier: Supplier, user: User, onPaymentLogged: () => void, disabled?: boolean }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState<number | string>('');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Paystack'>('Cash');
    const [customerEmail, setCustomerEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const outstanding = supplier.amountOwed - supplier.amountPaid;

    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setPaymentMethod('Cash');
            setCustomerEmail(supplier.email || '');
        }
    }, [isOpen, supplier.email]);
    
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numValue = parseFloat(value);
        if (value === '') {
            setAmount('');
        } else if (!isNaN(numValue) && numValue <= outstanding) {
            setAmount(numValue);
        } else if (numValue > outstanding) {
            setAmount(outstanding);
        }
    };
    
    const handleRecordPayment = async () => {
        const paymentAmount = Number(amount);
        if (!paymentAmount || paymentAmount <= 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid amount.'});
            return;
        }

        setIsSubmitting(true);
        if (paymentMethod === 'Cash') {
            const result = await handleLogPayment(supplier.id, paymentAmount);
            if (result.success) {
                toast({ title: 'Success', description: 'Cash payment logged successfully.' });
                onPaymentLogged();
                setIsOpen(false);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } else { // Paystack
            const loadingToast = toast({ title: "Initializing Payment...", description: "Please wait.", duration: Infinity });
            const paystackResult = await initializePaystackTransaction({
                email: customerEmail || user.email,
                total: paymentAmount,
                customerName: supplier.name,
                staffId: user.staff_id,
                items: [],
            });
            loadingToast.dismiss();

            if (paystackResult.success && paystackResult.reference) {
                const PaystackPop = (await import('@paystack/inline-js')).default;
                const paystack = new PaystackPop();
                paystack.newTransaction({
                    key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
                    email: customerEmail || user.email,
                    amount: Math.round(paymentAmount * 100),
                    ref: paystackResult.reference,
                    onSuccess: async () => {
                        const result = await handleLogPayment(supplier.id, paymentAmount);
                        if (result.success) {
                            toast({ title: 'Payment Successful', description: 'Paystack payment recorded.' });
                            onPaymentLogged();
                        } else {
                             toast({ variant: 'destructive', title: 'Payment Error', description: 'Payment succeeded but failed to log. Please contact support.' });
                        }
                    },
                    onClose: () => toast({ variant: 'destructive', title: 'Payment Cancelled' })
                });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: paystackResult.error });
            }
        }
        setIsSubmitting(false);
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button disabled={disabled}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Log Payment
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Log Payment to {supplier.name}</DialogTitle>
                    <DialogDescription>
                        Outstanding Balance: <span className="font-bold text-destructive">₦{outstanding.toLocaleString()}</span>
                    </DialogDescription>
                </DialogHeader>
                 <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Cash"><Wallet className="mr-2 h-4 w-4"/>Cash</SelectItem>
                                <SelectItem value="Paystack"><ArrowRightLeft className="mr-2 h-4 w-4"/>Paystack</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {paymentMethod === 'Paystack' && (
                        <div className="space-y-2">
                            <Label htmlFor="supplier-email">Supplier Email (for receipt)</Label>
                            <Input id="supplier-email" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="supplier@email.com" />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="payment-amount">Amount Paid (₦)</Label>
                        <Input id="payment-amount" type="number" value={amount} onChange={handleAmountChange} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleRecordPayment} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Log Payment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


function SupplierDetail({ supplier, onBack, user }: { supplier: Supplier, onBack: () => void, user: User | null }) {
    const { toast } = useToast();
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [supplyLogs, setSupplyLogs] = useState<SupplyLog[]>([]);
    const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    
    const canManageSupplies = user?.role === 'Manager' || user?.role === 'Developer' || user?.role === 'Storekeeper' || user?.role === 'Accountant';
    const canLogPayments = user?.role === 'Accountant' || user?.role === 'Developer';
    const isReadOnly = user?.role === 'Manager';


    const fetchDetails = useCallback(async () => {
        if (!user) return;
         const ingredientsCollection = collection(db, "ingredients");
        const ingredientSnapshot = await getDocs(ingredientsCollection);
        setIngredients(ingredientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Ingredient[]);

        const supplyLogsQuery = query(collection(db, 'supply_logs'), where('supplierId', '==', supplier.id), orderBy('date', 'desc'));
        const unsubSupplyLogs = onSnapshot(supplyLogsQuery, (snapshot) => {
            setSupplyLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplyLog)));
        });

        const paymentsQuery = query(collection(db, 'indirectCosts'), where('category', '==', 'Creditor Payments'), where('description', '==', `Payment to supplier: ${supplier.name}`), orderBy('date', 'desc'));
        const unsubPaymentLogs = onSnapshot(paymentsQuery, (snapshot) => {
            setPaymentLogs(snapshot.docs.map(doc => ({
                id: doc.id,
                supplierId: supplier.id,
                amount: doc.data().amount,
                date: doc.data().date,
                description: doc.data().description,
            } as PaymentLog)));
        });
        
         return () => {
            unsubSupplyLogs();
            unsubPaymentLogs();
        };

    }, [supplier.id, supplier.name, user]);
    
    useEffect(() => {
       const unsubPromise = fetchDetails();
       return () => {
           unsubPromise.then(unsub => unsub && unsub());
       }
    }, [fetchDetails]);
    
    useEffect(() => {
        const getDate = (log: any) => {
            if (!log.date) return new Date(0);
            if (log.date.toDate) return log.date.toDate();
            if (typeof log.date === 'string') return new Date(log.date);
            return new Date(0);
        }

        const combinedLogs: any[] = [
            ...supplyLogs.map(log => ({ ...log, type: 'supply', date: getDate(log) })),
            ...paymentLogs.map(log => ({ ...log, type: 'payment', date: getDate(log) }))
        ];
        
        combinedLogs.sort((a,b) => b.date - a.date);

        // We need to calculate running balance going forwards, so we reverse for calculation then reverse back
        const reversedLogs = [...combinedLogs].reverse();
        let runningBalance = 0; // Or fetch opening balance if available

        const calculatedTransactions = reversedLogs.map(log => {
             if (log.type === 'supply') {
                runningBalance += log.totalCost;
                return {
                    date: log.date,
                    description: `Supply: ${log.ingredientName}`,
                    debit: log.totalCost,
                    credit: null,
                    balance: runningBalance,
                }
            } else { // payment
                runningBalance -= log.amount;
                return {
                    date: log.date,
                    description: 'Payment',
                    debit: null,
                    credit: log.amount,
                    balance: runningBalance,
                }
            }
        });
        
        setTransactions(calculatedTransactions.reverse());
        if(isLoading) setIsLoading(false);
    }, [supplyLogs, paymentLogs, supplier, isLoading]);


    const filteredTransactions = useMemo(() => {
        return transactions.filter(log => 
            log.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [transactions, searchTerm]);

    const handleSaveLog = async (logData: Omit<SupplyLog, 'id' | 'supplierName'>, user: User) => {
        try {
            const batch = writeBatch(db);

            // 1. Create new supply log
            const logRef = doc(collection(db, 'supply_logs'));
            batch.set(logRef, { ...logData, supplierName: supplier.name });
            
            // 2. Update ingredient stock
            const ingredientRef = doc(db, 'ingredients', logData.ingredientId);
            batch.update(ingredientRef, { stock: increment(logData.quantity) });

            // 3. Update supplier amount owed
            const supplierRef = doc(db, 'suppliers', supplier.id);
            batch.update(supplierRef, { amountOwed: increment(logData.totalCost) });
            
            // 4. Add to Direct Costs
            await addDirectCost({
                description: `Purchase of ${logData.ingredientName} from ${supplier.name}`,
                category: 'Ingredients',
                quantity: logData.quantity,
                total: logData.totalCost,
            })

            await batch.commit();

            toast({ title: "Success", description: "Supply log saved and stock updated."});
        } catch(error) {
            console.error("Error saving supply log:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save supply log." });
        }
    }
    
    return (
        <div className="space-y-4">
            <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4"/>Back to Suppliers</Button>
            <Card>
                <CardHeader>
                    <CardTitle>{supplier.name}</CardTitle>
                    <CardDescription>{supplier.contactPerson} - {supplier.phone}</CardDescription>
                </CardHeader>
                 <CardContent className="grid md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Billed</CardTitle></CardHeader>
                        <CardContent><p className="text-2xl font-bold">₦{supplier.amountOwed.toLocaleString()}</p></CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Paid</CardTitle></CardHeader>
                        <CardContent><p className="text-2xl font-bold text-green-500">₦{supplier.amountPaid.toLocaleString()}</p></CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle></CardHeader>
                        <CardContent><p className="text-2xl font-bold text-destructive">₦{(supplier.amountOwed - supplier.amountPaid).toLocaleString()}</p></CardContent>
                    </Card>
                </CardContent>
            </Card>
            
            {canManageSupplies && !isReadOnly && (
              <SupplyLogDialog 
                  isOpen={isLogDialogOpen}
                  onOpenChange={setIsLogDialogOpen}
                  onSave={handleSaveLog}
                  supplier={supplier}
                  ingredients={ingredients}
                  user={user}
              />
            )}

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>A complete log of all supplies and payments for {supplier.name}.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input placeholder="Search logs..." className="pl-10 w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                            {canLogPayments && user && (
                                <LogPaymentDialog supplier={supplier} user={user} onPaymentLogged={fetchDetails} disabled={isReadOnly} />
                            )}
                            {canManageSupplies && !canLogPayments && (
                              <Button onClick={() => setIsLogDialogOpen(true)} disabled={isReadOnly}>
                                  <PlusCircle className="mr-2 h-4 w-4"/> Add Supply Log
                              </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Debit (Owed)</TableHead>
                                <TableHead className="text-right">Credit (Paid)</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                            ) : filteredTransactions.length > 0 ? (
                                filteredTransactions.map((log, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{format(log.date, 'Pp')}</TableCell>
                                        <TableCell>{log.description}</TableCell>
                                        <TableCell className="text-right text-red-500">{log.debit ? `₦${log.debit.toLocaleString()}`: '-'}</TableCell>
                                        <TableCell className="text-right text-green-500">{log.credit ? `₦${log.credit.toLocaleString()}` : '-'}</TableCell>
                                        <TableCell className="text-right font-bold">₦{log.balance.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                 <TableRow><TableCell colSpan={5} className="h-24 text-center">No transaction history found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}


export default function SuppliersPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        
        const suppliersCollection = collection(db, "suppliers");
        const unsubscribe = onSnapshot(suppliersCollection, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Supplier[];
            setSuppliers(list);
            if (isLoading) setIsLoading(false);
        }, (error) => {
            console.error("Error fetching suppliers:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch suppliers." });
        });
        
        return () => unsubscribe();
    }, [toast, isLoading]);

    const handleSaveSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
        try {
            if (editingSupplier && editingSupplier.id) {
                const ref = doc(db, "suppliers", editingSupplier.id);
                await updateDoc(ref, supplierData);
                toast({ title: "Success", description: "Supplier updated successfully." });
            } else {
                await addDoc(collection(db, "suppliers"), supplierData);
                toast({ title: "Success", description: "Supplier created successfully." });
            }
        } catch (error) {
            console.error("Error saving supplier:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save supplier." });
        }
    };

    const handleDeleteSupplier = async () => {
        if (!supplierToDelete) return;
        try {
            await deleteDoc(doc(db, "suppliers", supplierToDelete.id));
            toast({ title: "Success", description: "Supplier deleted successfully." });
        } catch (error) {
            console.error("Error deleting supplier:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete supplier." });
        } finally {
            setSupplierToDelete(null);
        }
    };
    
    const openAddDialog = () => {
        setEditingSupplier({});
        setIsDialogOpen(true);
    };

    const openEditDialog = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setIsDialogOpen(true);
    };

    const suppliersWithBalance = useMemo(() => {
        return suppliers.map(s => ({
            ...s,
            amountRemaining: s.amountOwed - s.amountPaid,
        }));
    }, [suppliers]);
    
    const canManageSuppliers = user?.role === 'Manager' || user?.role === 'Developer' || user?.role === 'Storekeeper' || user?.role === 'Accountant';
    const isStorekeeper = user?.role === 'Storekeeper';
    const isReadOnly = user?.role === 'Manager';


    if (selectedSupplier) {
        return <SupplierDetail supplier={selectedSupplier} onBack={() => setSelectedSupplier(null)} user={user} />;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold font-headline">Suppliers</h1>
                {canManageSuppliers && (
                  <Button onClick={openAddDialog} disabled={isReadOnly}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Supplier
                  </Button>
                )}
            </div>

            <SupplierDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleSaveSupplier}
                supplier={editingSupplier}
                user={user}
            />

            <Card>
                <CardHeader>
                    <CardTitle>All Suppliers</CardTitle>
                    <CardDescription>
                        Manage your suppliers and their balances. Click a supplier to view logs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Contact Person</TableHead>
                                <TableHead>Phone</TableHead>
                                {!isStorekeeper && <TableHead>Amount Owed</TableHead>}
                                {!isStorekeeper && <TableHead>Amount Paid</TableHead>}
                                {!isStorekeeper && <TableHead>Amount Remaining</TableHead>}
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={isStorekeeper ? 4 : 7} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : suppliersWithBalance.length > 0 ? (
                                suppliersWithBalance.map(supplier => (
                                    <TableRow 
                                        key={supplier.id} 
                                        className={cn(isStorekeeper ? "" : "cursor-pointer")}
                                        onClick={() => !isStorekeeper && setSelectedSupplier(supplier)}
                                    >
                                        <TableCell className="font-medium">{supplier.name}</TableCell>
                                        <TableCell>{supplier.contactPerson}</TableCell>
                                        <TableCell>{supplier.phone}</TableCell>
                                        {!isStorekeeper && <TableCell>₦{supplier.amountOwed.toFixed(2)}</TableCell>}
                                        {!isStorekeeper && <TableCell>₦{supplier.amountPaid.toFixed(2)}</TableCell>}
                                        {!isStorekeeper && 
                                            <TableCell className={supplier.amountRemaining > 0 ? 'text-destructive' : 'text-green-600'}>
                                                ₦{supplier.amountRemaining.toFixed(2)}
                                            </TableCell>
                                        }
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    {canManageSuppliers && (
                                                      <>
                                                        <DropdownMenuItem onSelect={() => openEditDialog(supplier)} disabled={isReadOnly}>Edit</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive" onSelect={() => setSupplierToDelete(supplier)} disabled={isReadOnly}>Delete</DropdownMenuItem>
                                                      </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={isStorekeeper ? 4 : 7} className="h-24 text-center">
                                        No suppliers found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AlertDialog open={!!supplierToDelete} onOpenChange={(open) => !open && setSupplierToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the supplier "{supplierToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSupplier}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
