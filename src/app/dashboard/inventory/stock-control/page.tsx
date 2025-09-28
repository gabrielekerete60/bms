
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  PlusCircle,
  Trash2,
  Calendar as CalendarIcon,
  Package,
  ArrowRightLeft,
  Wrench,
  Trash,
  Hourglass,
  Loader2,
  Check,
  X,
  Truck,
  Eye,
  CheckCircle,
  XCircle,
  History,
  Undo2,
  BookUser,
  Edit,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { collection, getDocs, query, where, orderBy, Timestamp, getDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { handleInitiateTransfer, handleReportWaste, getPendingTransfersForStaff, handleAcknowledgeTransfer, Transfer, getCompletedTransfersForStaff, WasteLog, getWasteLogsForStaff, getProductionTransfers, ProductionBatch, approveIngredientRequest, declineProductionBatch, getProducts, getProductsForStaff, handleReturnStock, getReturnedStockTransfers, returnUnusedIngredients } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogHeader, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { ProductEditDialog } from "../../components/product-edit-dialog";


type User = {
    name: string;
    role: string;
    staff_id: string;
};

type TransferItem = {
  productId: string;
  productName: string;
  quantity: number;
};

type StaffMember = {
  staff_id: string;
  name: string;
  role: string;
};

type Product = {
  id: string;
  name: string;
  stock: number;
  category: string;
  price: number;
  image: string;
  'data-ai-hint': string;
  costPrice?: number;
  lowStockThreshold?: number;
  minPrice?: number;
  maxPrice?: number;
};

type Ingredient = {
    id: string;
    name: string;
    unit: string;
    stock: number;
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


function ApproveBatchDialog({ batch, user, allIngredients, onApproval }: { batch: ProductionBatch, user: User, allIngredients: Ingredient[], onApproval: () => void }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    
    const ingredientsWithStock = useMemo(() => {
        return batch.ingredients.map(reqIng => {
            const stockIng = allIngredients.find(sIng => sIng.id === reqIng.ingredientId);
            const stockAvailable = stockIng?.stock || 0;
            const hasEnough = stockAvailable >= reqIng.quantity;
            return { ...reqIng, stockAvailable, hasEnough };
        });
    }, [batch.ingredients, allIngredients]);

    const canApprove = ingredientsWithStock.every(ing => ing.hasEnough);
    
    const handleApprove = async () => {
        setIsLoading(true);
        const result = await approveIngredientRequest(batch.id, batch.ingredients, user);
        if (result.success) {
            toast({ title: 'Success', description: 'Batch approved and moved to production.' });
            onApproval();
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    }

    const handleDecline = async () => {
        setIsLoading(true);
        const result = await declineProductionBatch(batch.id, user);
        if (result.success) {
            toast({ title: 'Success', description: 'Batch has been declined.' });
            onApproval();
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button size="sm">Review</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Approve Production Batch?</DialogTitle>
                    <DialogDescription>
                        Batch ID: {batch.id.substring(0,6)}...<br/>
                        Request for <strong>{batch.quantityToProduce} x {batch.productName}</strong>. This will deduct ingredients from inventory.
                    </DialogDescription>
                    <DialogClose />
                </DialogHeader>
                <div className="max-h-60 overflow-y-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Ingredient</TableHead><TableHead>Required</TableHead><TableHead>In Stock</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {ingredientsWithStock.map(ing => (
                                <TableRow key={ing.ingredientId}>
                                    <TableCell>{ing.ingredientName}</TableCell>
                                    <TableCell>{ing.quantity} {ing.unit}</TableCell>
                                    <TableCell>{ing.stockAvailable.toFixed(2)} {ing.unit}</TableCell>
                                    <TableCell>
                                        {ing.hasEnough ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter className="gap-2">
                     <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                     <Button variant="destructive" onClick={handleDecline} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}
                        Decline
                    </Button>
                     <Button onClick={handleApprove} disabled={isLoading || !canApprove}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                        Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AcceptTransferDialog({ transfer, onAccept, children }: { transfer: Transfer, onAccept: (id: string, action: 'accept' | 'decline') => void, children: React.ReactNode }) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAction = async (action: 'accept' | 'decline') => {
        setIsSubmitting(true);
        await onAccept(transfer.id, action);
        setIsSubmitting(false);
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                {children}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Acknowledge Transfer: {transfer.id.substring(0, 6).toUpperCase()}</AlertDialogTitle>
                    <AlertDialogDescription>
                        You are about to accept responsibility for the following items. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4 max-h-[400px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Quantity</TableHead>
                                {transfer.totalValue != null && <TableHead className="text-right">Value</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transfer.items.map(item => (
                                <TableRow key={item.productId}>
                                    <TableCell>{item.productName}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    {transfer.totalValue != null && <TableCell className="text-right">₦{((item.price || 0) * item.quantity).toLocaleString()}</TableCell>}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {transfer.notes && (
                    <div className="text-sm space-y-1 mt-2">
                        <p className="font-semibold">Notes from Sender:</p>
                        <p className="p-2 bg-muted rounded-md">{transfer.notes}</p>
                    </div>
                )}
                {transfer.totalValue != null && (
                    <div className="font-bold text-lg flex justify-between border-t pt-4">
                        <span>Total Run Value:</span>
                        <span>₦{(transfer.totalValue || 0).toLocaleString()}</span>
                    </div>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleAction('decline')} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Decline
                    </AlertDialogAction>
                    <AlertDialogAction onClick={() => handleAction('accept')} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Accept
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}


function ReportWasteTab({ products, user, onWasteReported }: { products: { productId: string; productName: string; stock: number }[], user: User | null, onWasteReported: () => void }) {
    const { toast } = useToast();
    const [items, setItems] = useState<{ productId: string, quantity: number | string }[]>([{ productId: '', quantity: 1 }]);
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleItemChange = (index: number, field: 'productId' | 'quantity', value: string) => {
        const newItems = [...items];
        if (field === 'quantity') {
            const numValue = Number(value);
            const productInfo = products.find(p => p.productId === newItems[index].productId);
            if (productInfo && numValue > productInfo.stock) {
                toast({ variant: 'destructive', title: 'Error', description: `Cannot report more than ${productInfo.stock} units of waste for this item.` });
                newItems[index][field] = productInfo.stock;
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
        if (items.some(item => !item.productId || !item.quantity || Number(item.quantity) <= 0) || !reason || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields.' });
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
            toast({ title: 'Success', description: 'Waste reported successfully. Inventory has been updated.' });
            setItems([{ productId: '', quantity: 1 }]);
            setReason("");
            setNotes("");
            onWasteReported(); // Callback to refresh product list
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    }
    
    const getAvailableProductsForRow = (rowIndex: number) => {
        const selectedIdsInOtherRows = new Set(
            items.filter((_, i) => i !== rowIndex).map(item => item.productId)
        );
        return products.filter(p => !selectedIdsInOtherRows.has(p.productId));
    };
    
    return (
        <Card className="flex-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trash /> Report Spoiled or Damaged Stock</CardTitle>
                <CardDescription>
                    Use this form to report any items that are no longer sellable from your personal stock. This will deduct the items from your inventory.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>Items to Report</Label>
                    <div className="space-y-2">
                        {items.map((item, index) => {
                            const availableProducts = getAvailableProductsForRow(index);
                            return (
                                <div key={`waste-item-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                                    <Select value={item.productId} onValueChange={(val) => handleItemChange(index, 'productId', val)}>
                                        <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                                        <SelectContent>
                                            {availableProducts.map((p) => (
                                                <SelectItem key={`${p.productId}-${index}`} value={p.productId}>
                                                    {p.productName} (Stock: {p.stock})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                    <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger id="waste-reason">
                            <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="Spoiled">Spoiled / Expired</SelectItem>
                           <SelectItem value="Damaged">Damaged</SelectItem>
                           <SelectItem value="Burnt">Burnt (Production)</SelectItem>
                           <SelectItem value="Error">Error (Mistake)</SelectItem>
                           <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="waste-notes">Additional Notes (Optional)</Label>
                    <Input id="waste-notes" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Submit Report
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ReturnStockDialog({ user, onReturn, personalStock, staffList, returnType }: { user: User, onReturn: () => void, personalStock: { productId: string, productName: string, stock: number }[], staffList: StaffMember[], returnType: 'product' | 'ingredient' }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [itemsToReturn, setItemsToReturn] = useState<Record<string, number | string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [returnTo, setReturnTo] = useState('');

    const title = returnType === 'product' ? 'Return Unsold Stock' : 'Return Unused Ingredients';
    const description = returnType === 'product' ? 'Enter quantities for products you want to return.' : 'Return unused ingredients from a production run back to the main store.';

    const returnableStaff = useMemo(() => {
        if (user.role === 'Showroom Staff') {
            return staffList.filter(s => s.role === 'Storekeeper' || s.role === 'Delivery Staff');
        }
        if (user.role === 'Baker' || user.role === 'Chief Baker') {
            return staffList.filter(s => s.role === 'Storekeeper');
        }
        return [];
    }, [staffList, user.role]);
    
    useEffect(() => {
        if (isOpen) {
            setItemsToReturn({});
            setReturnTo('');
        }
    }, [isOpen]);

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
                const stockItem = personalStock.find(p => p.productId === id);
                return {
                    productId: id,
                    productName: stockItem?.productName || 'Unknown',
                    quantity: Number(quantity),
                };
            })
            .filter(item => item.quantity > 0);

        if (items.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a quantity for at least one item.' });
            return;
        }

        setIsSubmitting(true);
        
        let result;
        if(returnType === 'product') {
            result = await handleReturnStock("showroom-return", items, user, returnTo);
        } else {
            // This is a simplified view, it should be a proper function
            result = await returnUnusedIngredients(items.map(i => ({ingredientId: i.productId, quantity: i.quantity, ingredientName: i.productName})), user);
        }
        
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
                    <Undo2 className="mr-2 h-4 w-4" /> {title}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="py-4 max-h-96 overflow-y-auto space-y-4">
                    <div className="space-y-2">
                        <Label>Return to</Label>
                        <Select value={returnTo} onValueChange={setReturnTo}>
                            <SelectTrigger><SelectValue placeholder="Select staff to return to..." /></SelectTrigger>
                            <SelectContent>
                                {returnableStaff.map(s => (
                                    <SelectItem key={s.staff_id} value={s.staff_id}>{s.name} ({s.role})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                            {personalStock.map(item => (
                                <TableRow key={item.productId}>
                                    <TableCell>{item.productName}</TableCell>
                                    <TableCell className="text-center">{item.stock}</TableCell>
                                    <TableCell className="text-right">
                                        <Input
                                            type="number"
                                            className="w-24 h-8 text-right ml-auto"
                                            placeholder="0"
                                            value={itemsToReturn[item.productId] || ''}
                                            onChange={(e) => handleQuantityChange(item.productId, e.target.value, item.stock)}
                                            max={item.stock}
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

export default function StockControlPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [isSalesRun, setIsSalesRun] = useState(false);
  const [isSalesRunDisabled, setIsSalesRunDisabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Partial<TransferItem>[]>([
    { productId: "", quantity: 1 },
  ]);
  
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [initiatedTransfers, setInitiatedTransfers] = useState<Transfer[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<Transfer[]>([]);
  const [productionTransfers, setProductionTransfers] = useState<Transfer[]>([]);
  const [returnedStock, setReturnedStock] = useState<Transfer[]>([]);
  const [pendingBatches, setPendingBatches] = useState<ProductionBatch[]>([]);
  const [completedTransfers, setCompletedTransfers] = useState<Transfer[]>([]);
  const [myWasteLogs, setMyWasteLogs] = useState<WasteLog[]>([]);
  const [personalStock, setPersonalStock] = useState<{ productId: string, productName: string, stock: number }[]>([]);
  
  const [date, setDate] = useState<DateRange | undefined>();
  const [allPendingDate, setAllPendingDate] = useState<DateRange | undefined>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);


  const [visiblePendingRows, setVisiblePendingRows] = useState<number | 'all'>(10);
  const [visibleHistoryRows, setVisibleHistoryRows] = useState<number | 'all'>(10);
  const [visibleLogRows, setVisibleLogRows] = useState<number | 'all'>(10);
  const [visibleAllPendingRows, setVisibleAllPendingRows] = useState<number | 'all'>(10);
  
  const fetchPageData = useCallback(async () => {
    const userStr = localStorage.getItem('loggedInUser');
    if (!userStr) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user.' });
        setIsLoading(false);
        return;
    }
    const currentUser = JSON.parse(userStr);
    setUser(currentUser);
    
    try {
        const staffQuery = query(collection(db, "staff"), where("role", "!=", "Developer"));
        const staffSnapshot = await getDocs(staffQuery);
        setStaff(staffSnapshot.docs.map(doc => ({ staff_id: doc.id, name: doc.data().name, role: doc.data().role })));

        const userRole = currentUser.role;
        const canManageStore = ['Manager', 'Supervisor', 'Storekeeper', 'Developer'].includes(userRole);
        
        const productsSnapshot = await getDocs(collection(db, "products"));
        setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

        
        const isSalesStaff = ['Delivery Staff', 'Showroom Staff'].includes(userRole);
        if (isSalesStaff) {
            const stockData = await getProductsForStaff(currentUser.staff_id);
            setPersonalStock(stockData.map(d => ({productId: d.productId, productName: d.name, stock: d.stock})));
        }
        
        const [pendingData, completedData, wasteData, prodTransfers, ingredientsSnapshot, initiatedTransfersSnapshot, returnedStockSnapshot] = await Promise.all([
            getPendingTransfersForStaff(currentUser.staff_id),
            getCompletedTransfersForStaff(currentUser.staff_id),
            getWasteLogsForStaff(currentUser.staff_id),
            getProductionTransfers(),
            getDocs(collection(db, "ingredients")),
            getDocs(query(collection(db, "transfers"), orderBy("date", "desc"))),
            getReturnedStockTransfers(),
        ]);

        setPendingTransfers(pendingData);
        setCompletedTransfers(completedData);
        setMyWasteLogs(wasteData);
        setProductionTransfers(prodTransfers);
        setIngredients(ingredientsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, unit: doc.data().unit, stock: doc.data().stock } as Ingredient)));
        setInitiatedTransfers(initiatedTransfersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate().toISOString() } as Transfer)));
        setReturnedStock(returnedStockSnapshot);

    } catch (error) {
        console.error("Error fetching data:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load necessary data." });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPageData();

    const userStr = localStorage.getItem('loggedInUser');
    if (userStr) {
      const currentUser = JSON.parse(userStr);
      const qPendingBatches = query(collection(db, 'production_batches'), where('status', '==', 'pending_approval'));
      const unsubBatches = onSnapshot(qPendingBatches, (snapshot) => {
          setPendingBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt.toDate().toISOString() } as ProductionBatch)));
          setIsLoadingBatches(false);
      });

      return () => {
          unsubBatches();
      };
    }
  }, []);

  const handleTransferToChange = (staffId: string) => {
    setTransferTo(staffId);
    const selectedStaff = staff.find(s => s.staff_id === staffId);
    if (selectedStaff) {
        if (selectedStaff.role === 'Delivery Staff') {
            setIsSalesRun(true);
            setIsSalesRunDisabled(true);
        } else if (selectedStaff.role === 'Showroom Staff') {
            setIsSalesRun(false);
            setIsSalesRunDisabled(true);
        } else {
            setIsSalesRun(false);
            setIsSalesRunDisabled(false);
        }
    }
  }

  const handleItemChange = (
    index: number,
    field: keyof TransferItem,
    value: string | number
  ) => {
    const newItems = [...items];
    const item = newItems[index];

    if (field === "productId") {
      const product = products.find(p => p.id === value);
      item.productId = value as string;
      item.productName = product?.name;
    } else {
        const product = products.find(p => p.id === item.productId);
        const newQuantity = Number(value);
        if (product && newQuantity > product.stock) {
            toast({
                variant: "destructive",
                title: "Stock Exceeded",
                description: `Cannot transfer more than ${product.stock} units of ${product.name}.`
            });
            item.quantity = product.stock;
        } else {
            item.quantity = newQuantity;
        }
    }
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { productId: "", quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!transferTo || items.some(i => !i.productId || !i.quantity) || !user) {
        toast({ variant: "destructive", title: "Error", description: "Please select a staff member and fill all item fields."});
        return;
    }

    for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product || item.quantity! > product.stock) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: `Stock for ${item.productName} is insufficient. Maximum: ${product?.stock}.`
            });
            return;
        }
    }

    setIsSubmitting(true);
    const staffMember = staff.find(s => s.staff_id === transferTo);
    
    const transferData = {
        to_staff_id: transferTo,
        to_staff_name: staffMember?.name || 'Unknown',
        is_sales_run: isSalesRun,
        notes: notes,
        items: items as TransferItem[],
    }

    const result = await handleInitiateTransfer(transferData, user);

    if (result.success) {
        toast({ title: "Success", description: "Transfer initiated successfully." });
        setTransferTo("");
        setIsSalesRun(false);
        setNotes("");
        setItems([{ productId: "", quantity: 1 }]);
        fetchPageData();

    } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
    }

    setIsSubmitting(false);
  };
  
  const handleAcknowledge = async (id: string, type: 'accept' | 'decline') => {
    setIsSubmitting(true);
    const result = await handleAcknowledgeTransfer(id, type);
    if (result.success) {
        const message = type === 'accept' ? 'Transfer accepted.' : 'Transfer has been declined.';
        toast({ title: 'Success', description: message });
        fetchPageData();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSubmitting(false);
  };

  const paginatedPending = useMemo(() => {
    return visiblePendingRows === 'all' ? pendingTransfers : pendingTransfers.slice(0, visiblePendingRows);
  }, [pendingTransfers, visiblePendingRows]);

  const paginatedHistory = useMemo(() => {
    return visibleHistoryRows === 'all' ? completedTransfers : completedTransfers.slice(0, visibleHistoryRows);
  }, [completedTransfers, visibleHistoryRows]);

  const allPendingTransfers = useMemo(() => {
    let filtered = initiatedTransfers.filter(t => t.status === 'pending');
    if (allPendingDate?.from) {
        const from = startOfDay(allPendingDate.from);
        const to = allPendingDate.to ? endOfDay(allPendingDate.to) : endOfDay(allPendingDate.from);
        filtered = filtered.filter(t => {
            const transferDate = new Date(t.date);
            return transferDate >= from && transferDate <= to;
        })
    }
    return filtered;
  }, [initiatedTransfers, allPendingDate]);

  const paginatedAllPending = useMemo(() => {
    return visibleAllPendingRows === 'all' ? allPendingTransfers : allPendingTransfers.slice(0, visibleAllPendingRows);
  }, [allPendingTransfers, visibleAllPendingRows]);
  
  const paginatedLogs = useMemo(() => {
    let filtered = initiatedTransfers;
    if (date?.from) {
        const from = startOfDay(date.from);
        const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
        filtered = filtered.filter(t => {
            const transferDate = new Date(t.date);
            return transferDate >= from && transferDate <= to;
        })
    }
    return visibleLogRows === 'all' ? filtered : filtered.slice(0, visibleLogRows);
  }, [initiatedTransfers, visibleLogRows, date]);
  
  const getAvailableProductsForRow = (rowIndex: number) => {
    const selectedIdsInOtherRows = new Set(
        items.filter((_, i) => i !== rowIndex).map(item => item.productId)
    );
    return products.filter(p => !selectedIdsInOtherRows.has(p.id));
  };
  
  const productCategories = useMemo(() => ['All', ...new Set(products.map(p => p.category))], [products]);


  const userRole = user?.role;
  const isManagerOrDev = userRole === 'Manager' || userRole === 'Developer';
  const isStorekeeper = userRole === 'Storekeeper';
  const isBaker = userRole === 'Baker' || userRole === 'Chief Baker';
  const canInitiateTransfer = isManagerOrDev || isStorekeeper;
  
  if (!user || isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!canInitiateTransfer) {
     return (
        <div className="space-y-6">
             <ProductEditDialog 
                product={editingProduct}
                onOpenChange={() => setEditingProduct(null)}
                onProductUpdate={fetchPageData}
                user={user}
                categories={productCategories}
             />
            <h1 className="text-2xl font-bold font-headline">Stock Control</h1>
            <Tabs defaultValue="my-stock" className="w-full">
                <TabsList>
                    <TabsTrigger value="my-stock">My Stock</TabsTrigger>
                    <TabsTrigger value="acknowledge-stock" className="relative">
                        Acknowledge Stock
                        {pendingTransfers.length > 0 && <Badge variant="destructive" className="ml-2">{pendingTransfers.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="my-stock" className="mt-4">
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>My Personal Stock</CardTitle>
                                    <CardDescription>Items currently in your possession.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Quantity</TableHead>{user.role === 'Developer' && <TableHead></TableHead>}</TableRow></TableHeader>
                                        <TableBody>
                                            {personalStock.length === 0 ? (
                                                <TableRow><TableCell colSpan={user.role === 'Developer' ? 3 : 2} className="h-24 text-center">Your personal stock is empty.</TableCell></TableRow>
                                            ) : (
                                                personalStock.map(item => {
                                                    const fullProduct = products.find(p => p.id === item.productId);
                                                    return (
                                                    <TableRow key={item.productId}>
                                                        <TableCell>{item.productName}</TableCell>
                                                        <TableCell className="text-right">{item.stock}</TableCell>
                                                        {user.role === 'Developer' && (
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" onClick={() => setEditingProduct(fullProduct!)}>
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                )})
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                             {isBaker && (
                                <ReturnStockDialog user={user} onReturn={fetchPageData} personalStock={[]} staffList={staff} returnType="ingredient" />
                            )}
                        </div>
                        <div className="lg:col-span-1 flex flex-col gap-6">
                            <ReportWasteTab products={personalStock} user={user} onWasteReported={fetchPageData} />
                            {(userRole === 'Showroom Staff' || isBaker) && (
                                <Card>
                                    <CardHeader><CardTitle>Return Stock</CardTitle></CardHeader>
                                    <CardContent>
                                        <ReturnStockDialog user={user} onReturn={fetchPageData} personalStock={personalStock} staffList={staff} returnType="product" />
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="acknowledge-stock" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package />
                                Acknowledge Incoming Stock
                            </CardTitle>
                            <CardDescription>Review and acknowledge stock transferred to you. Accepted Sales Runs will appear in your "Deliveries" tab.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="md:hidden space-y-4">
                                {isLoading ? (
                                    <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                                ) : paginatedPending.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-12">No pending transfers.</p>
                                ) : (
                                    paginatedPending.map(t => (
                                        <Card key={t.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold">{t.from_staff_name}</p>
                                                    <p className="text-sm text-muted-foreground">{format(new Date(t.date), 'Pp')}</p>
                                                </div>
                                                {t.is_sales_run ? <Badge variant="secondary"><Truck className="h-3 w-3 mr-1" />Sales Run</Badge> : <Badge variant="outline"><Package className="h-3 w-3 mr-1"/>Stock</Badge>}
                                            </div>
                                            <div className="text-sm">
                                                Items: {t.items.reduce((sum, item) => sum + item.quantity, 0)}
                                            </div>
                                            <div className="flex justify-end">
                                                <AcceptTransferDialog transfer={t} onAccept={handleAcknowledge}>
                                                    <Button size="sm">View & Acknowledge</Button>
                                                </AcceptTransferDialog>
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
                                            <TableHead>From</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Items</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                                        ) : paginatedPending.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="h-24 text-center">No pending transfers.</TableCell></TableRow>
                                        ) : (
                                            paginatedPending.map(t => (
                                                <TableRow key={t.id}>
                                                    <TableCell>{t.date ? format(new Date(t.date), 'Pp') : 'N/A'}</TableCell>
                                                    <TableCell>{t.from_staff_name}</TableCell>
                                                    <TableCell>
                                                        {t.is_sales_run ? <Badge variant="secondary"><Truck className="h-3 w-3 mr-1" />Sales Run</Badge> : <Badge variant="outline"><Package className="h-3 w-3 mr-1"/>Stock</Badge>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {t.items.reduce((sum, item) => sum + item.quantity, 0)} items
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <AcceptTransferDialog transfer={t} onAccept={handleAcknowledge}>
                                                            <Button size="sm">View & Acknowledge</Button>
                                                        </AcceptTransferDialog>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <PaginationControls visibleRows={visiblePendingRows} setVisibleRows={setVisiblePendingRows} totalRows={pendingTransfers.length} />
                        </CardFooter>
                    </Card>
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><History /> My Transfer History</CardTitle>
                            <CardDescription>A log of all stock transfers you have successfully accepted.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="md:hidden space-y-4">
                                {paginatedHistory.map(t => (
                                    <Card key={t.id} className="p-4 space-y-2">
                                         <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{t.from_staff_name}</p>
                                                <p className="text-xs text-muted-foreground">Received: {t.time_received ? format(new Date(t.time_received), 'Pp') : 'N/A'}</p>
                                            </div>
                                            <Badge>{t.status}</Badge>
                                        </div>
                                         <div className="text-sm pt-2 border-t flex justify-between items-center">
                                            {t.is_sales_run ? <Badge variant="secondary"><Truck className="h-3 w-3 mr-1" />Sales Run</Badge> : <Badge variant="outline"><Package className="h-3 w-3 mr-1"/>Stock</Badge>}
                                            {t.is_sales_run && t.status === 'active' && (
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/dashboard/deliveries`}><Eye className="mr-2 h-4 w-4"/>Manage</Link>
                                                </Button>
                                            )}
                                         </div>
                                    </Card>
                                ))}
                            </div>
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Received</TableHead>
                                            <TableHead>Completed</TableHead>
                                            <TableHead>From</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                                    ) : paginatedHistory.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center">You have no completed transfers.</TableCell></TableRow>
                                    ) : (
                                        paginatedHistory.map(t => (
                                            <TableRow key={t.id}>
                                                <TableCell>{t.time_received ? format(new Date(t.time_received), 'Pp') : 'N/A'}</TableCell>
                                                <TableCell>{t.time_completed ? format(new Date(t.time_completed), 'Pp') : 'N/A'}</TableCell>
                                                <TableCell>{t.from_staff_name}</TableCell>
                                                <TableCell>
                                                    {t.is_sales_run ? <Badge variant="secondary"><Truck className="h-3 w-3 mr-1" />Sales Run</Badge> : <Badge variant="outline"><Package className="h-3 w-3 mr-1"/>Stock</Badge>}
                                                </TableCell>
                                                <TableCell><Badge>{t.status}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    {t.is_sales_run && t.status === 'active' && (
                                                        <Button variant="outline" size="sm" asChild>
                                                            <Link href={`/dashboard/deliveries`}><Eye className="mr-2 h-4 w-4"/>Manage Run</Link>
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                         <CardFooter>
                            <PaginationControls visibleRows={visibleHistoryRows} setVisibleRows={setVisibleHistoryRows} totalRows={completedTransfers.length} />
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
         </div>
     )
  }

  // Full view for admins
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold font-headline">Stock Control</h1>
      </div>
      <Tabs defaultValue={isStorekeeper ? 'initiate-transfer' : 'pending-transfers'}>
        <div className="overflow-x-auto pb-2">
            <TabsList>
                {isStorekeeper && 
                    <TabsTrigger value="initiate-transfer">
                        <Send className="mr-2 h-4 w-4" /> Initiate Transfer
                    </TabsTrigger>
                }
                 {isStorekeeper && 
                    <TabsTrigger value="batch-approvals" className="relative">
                        <Wrench className="mr-2 h-4 w-4" /> Batch Approvals
                        {pendingBatches.length > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full p-0">
                                {pendingBatches.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                }
                 {isStorekeeper && 
                    <TabsTrigger value="returned-stock" className="relative">
                        <Undo2 className="mr-2 h-4 w-4" /> Returned Stock
                        {returnedStock.length > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full p-0">
                                {returnedStock.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                }
                 {isStorekeeper && 
                    <TabsTrigger value="production-transfers" className="relative">
                        <ArrowRightLeft className="mr-2 h-4 w-4" /> Production Transfers
                        {productionTransfers.length > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full p-0">
                                {productionTransfers.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                }
                <TabsTrigger value="pending-transfers" className="relative">
                    <Hourglass className="mr-2 h-4 w-4" /> All Pending
                    {allPendingTransfers.length > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full p-0">
                            {allPendingTransfers.length}
                        </Badge>
                    )}
                </TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="initiate-transfer">
        <Card>
            <CardHeader>
            <CardTitle>Transfer Stock to Sales Floor</CardTitle>
            <CardDescription>
                Initiate a transfer of finished products from the main store to a
                sales staff member.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="transfer-to">Transfer to</Label>
                    <Select value={transferTo} onValueChange={handleTransferToChange} disabled={isLoading}>
                    <SelectTrigger id="transfer-to">
                        <SelectValue placeholder="Select a staff member" />
                    </SelectTrigger>
                    <SelectContent>
                        {staff.filter(s => s.role === 'Showroom Staff' || s.role === 'Delivery Staff').map((s) => (
                        <SelectItem key={s.staff_id} value={s.staff_id}>
                            {s.name} ({s.role})
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
                <div className="flex items-end pb-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="sales-run" checked={isSalesRun} onCheckedChange={(checked) => setIsSalesRun(checked as boolean)} disabled={isSalesRunDisabled}/>
                        <div className="grid gap-1.5 leading-none">
                            <label
                            htmlFor="sales-run"
                            className={cn("text-sm font-medium leading-none", isSalesRunDisabled ? "text-muted-foreground" : "peer-disabled:cursor-not-allowed peer-disabled:opacity-50")}
                            >
                            This is for a sales run
                            </label>
                            <p className="text-sm text-muted-foreground">
                            The recipient will manage sales for these items.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Items to Transfer</Label>
                <div className="space-y-2">
                {items.map((item, index) => {
                    const availableProducts = getAvailableProductsForRow(index);
                    return (
                        <div
                        key={index}
                        className="grid grid-cols-[1fr_120px_auto] gap-2 items-center"
                        >
                        <Select
                            value={item.productId}
                            onValueChange={(value) =>
                            handleItemChange(index, "productId", value)
                            }
                            disabled={isLoading}
                        >
                            <SelectTrigger>
                            <SelectValue placeholder="Select a product" />
                            </SelectTrigger>
                            <SelectContent>
                            {availableProducts.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                {p.name} (Stock: {p.stock})
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <Input
                            type="number"
                            placeholder="Qty"
                            min="1"
                            value={item.quantity || ''}
                            onChange={(e) =>
                            handleItemChange(index, "quantity", e.target.value)
                            }
                        />
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                    );
                })}
                </div>
                <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleAddItem}
                >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Button>
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={isSubmitting || isLoading}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Submit Transfer
                </Button>
            </div>
            </CardContent>
        </Card>
        </TabsContent>
         <TabsContent value="batch-approvals">
             <Card>
                <CardHeader>
                    <CardTitle>Pending Batch Approvals</CardTitle>
                    <CardDescription>Batches requested by bakers that need ingredient approval from the storekeeper.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden space-y-4">
                        {isLoadingBatches ? (
                            <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                        ) : pendingBatches.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">No batches are pending approval.</p>
                        ) : (
                            pendingBatches.map(batch => (
                                <Card key={batch.id} className="p-4 space-y-3">
                                    <div>
                                        <p className="font-semibold">{batch.productName}</p>
                                        <p className="text-sm text-muted-foreground">{batch.requestedByName} - {format(new Date(batch.createdAt), 'PPP')}</p>
                                    </div>
                                    <div className="flex justify-end">
                                        <ApproveBatchDialog batch={batch} user={user} allIngredients={ingredients} onApproval={fetchPageData} />
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Quantity</TableHead><TableHead>Requested By</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {isLoadingBatches ? (
                                    <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                                ) : pendingBatches.length > 0 ? pendingBatches.map(batch => (
                                    <TableRow key={batch.id}>
                                        <TableCell>{format(new Date(batch.createdAt), 'PPP')}</TableCell>
                                        <TableCell>{batch.productName}</TableCell>
                                        <TableCell>{batch.quantityToProduce}</TableCell>
                                        <TableCell>{batch.requestedByName}</TableCell>
                                        <TableCell><ApproveBatchDialog batch={batch} user={user} allIngredients={ingredients} onApproval={fetchPageData} /></TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={5} className="text-center h-24">No batches are pending approval.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
              </Card>
        </TabsContent>
         <TabsContent value="returned-stock">
            <Card>
                <CardHeader>
                    <CardTitle>Returned Stock</CardTitle>
                    <CardDescription>Acknowledge unsold stock returned by sales staff.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>From</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                            ) : returnedStock.length > 0 ? (
                                returnedStock.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{t.date ? format(new Date(t.date), 'Pp') : 'N/A'}</TableCell>
                                        <TableCell>{t.from_staff_name}</TableCell>
                                        <TableCell>{t.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                                        <TableCell className="text-right">
                                            <AcceptTransferDialog transfer={t} onAccept={handleAcknowledge}>
                                                <Button size="sm">Acknowledge</Button>
                                            </AcceptTransferDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center">No pending stock returns.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
         <TabsContent value="production-transfers">
              <Card>
                <CardHeader>
                    <CardTitle>Production Transfers</CardTitle>
                    <CardDescription>Acknowledge finished goods transferred from the production unit to the main store.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                        ) : productionTransfers.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">No pending transfers from production.</p>
                        ) : (
                            productionTransfers.map(t => (
                                <Card key={t.id} className="p-4 space-y-3">
                                    <div>
                                        <p className="font-semibold">{t.from_staff_name}</p>
                                        <p className="text-xs text-muted-foreground">{t.date ? format(new Date(t.date), 'Pp') : 'N/A'}</p>
                                        <p className="text-sm">Items: {t.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                                    </div>
                                    <div className="flex justify-end">
                                        <AcceptTransferDialog transfer={t} onAccept={handleAcknowledge}>
                                            <Button size="sm">Acknowledge</Button>
                                        </AcceptTransferDialog>
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
                                    <TableHead>From</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                                ) : productionTransfers.length > 0 ? (
                                    productionTransfers.map(t => (
                                        <TableRow key={t.id}>
                                            <TableCell>{t.date ? format(new Date(t.date), 'Pp') : 'N/A'}</TableCell>
                                            <TableCell>{t.from_staff_name}</TableCell>
                                            <TableCell>{t.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                                            <TableCell className="text-right">
                                                <AcceptTransferDialog transfer={t} onAccept={handleAcknowledge}>
                                                    <Button size="sm">
                                                        <Check className="mr-2 h-4 w-4" /> Accept
                                                    </Button>
                                                </AcceptTransferDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No pending transfers from production.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="pending-transfers">
              <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>All Pending Transfers</CardTitle>
                            <CardDescription>A log of all transfers awaiting acknowledgement across the system.</CardDescription>
                        </div>
                        <DateRangeFilter date={allPendingDate} setDate={setAllPendingDate}/>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden space-y-4">
                         {isLoading ? (
                            <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                        ) : paginatedAllPending.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">No pending transfers found.</p>
                        ) : (
                            paginatedAllPending.map(t => (
                                <Card key={t.id} className="p-4 space-y-2">
                                     <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">To: {t.to_staff_name}</p>
                                            <p className="text-xs text-muted-foreground">From: {t.from_staff_name} on {t.date ? format(new Date(t.date), 'PPp') : 'N/A'}</p>
                                        </div>
                                        <Badge variant="secondary">{t.status}</Badge>
                                    </div>
                                    <div className="text-sm">Items: {t.items.reduce((sum, item) => sum + item.quantity, 0)}</div>
                                </Card>
                            ))
                        )}
                    </div>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>From</TableHead>
                                    <TableHead>To</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                                ) : (
                                    paginatedAllPending.map((transfer) => (
                                        <TableRow key={transfer.id}>
                                            <TableCell>{transfer.date ? format(new Date(transfer.date), 'PPpp') : 'N/A'}</TableCell>
                                            <TableCell>{transfer.from_staff_name}</TableCell>
                                            <TableCell>{transfer.to_staff_name}</TableCell>
                                            <TableCell>{transfer.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                                            <TableCell><Badge variant="secondary">{transfer.status}</Badge></TableCell>
                                        </TableRow>
                                    ))
                                )}
                                { !isLoading && paginatedAllPending.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No pending transfers found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                  <PaginationControls visibleRows={visibleAllPendingRows} setVisibleRows={setVisibleAllPendingRows} totalRows={allPendingTransfers.length} />
                </CardFooter>
              </Card>
          </TabsContent>
      </Tabs>
    </div>
  );
}

