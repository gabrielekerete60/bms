

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, PlusCircle, Loader2, ChevronsUp, Calendar as CalendarIcon, ArrowDown, ArrowUp, Eye, FileUp } from "lucide-react";
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
  DialogClose,
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
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, increment, serverTimestamp, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { getIngredientStockLogs, IngredientStockLog, ProductionBatch, getProductionBatch, getSupplyLog, SupplyLog, requestStockIncrease } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type User = {
    name: string;
    role: string;
    staff_id: string;
};

type Ingredient = {
  id: string;
  name: string;
  stock: number;
  unit: string;
  costPerUnit: number;
  expiryDate: string | null;
  lowStockThreshold?: number;
};

type Supplier = {
  id: string;
  name: string;
};


function IngredientDialog({
  isOpen,
  onOpenChange,
  onSave,
  ingredient,
  user
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<Omit<Ingredient, 'id'>>) => void;
  ingredient: Partial<Ingredient> | null;
  user: User | null;
}) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("");
    const [stock, setStock] = useState<number | string>(0);
    const [costPerUnit, setCostPerUnit] = useState<number | string>(0);
    const [expiryDate, setExpiryDate] = useState<Date | undefined>();
    const [lowStockThreshold, setLowStockThreshold] = useState<number | string>(10);
    
    const isStorekeeper = user?.role === 'Storekeeper';
    const isDeveloper = user?.role === 'Developer';


    useEffect(() => {
        if (ingredient) {
            setName(ingredient.name || "");
            setUnit(ingredient.unit || "");
            setStock(ingredient.stock || 0);
            setCostPerUnit(ingredient.costPerUnit || 0);
            setExpiryDate(ingredient.expiryDate ? new Date(ingredient.expiryDate) : undefined);
            setLowStockThreshold(ingredient.lowStockThreshold || 10);
        } else {
            setName("");
            setUnit("");
            setStock(0);
            setCostPerUnit("");
            setExpiryDate(undefined);
            setLowStockThreshold(10);
        }
    }, [ingredient]);

    const handleSubmit = () => {
        if (!name || !unit) {
            toast({ variant: 'destructive', title: 'Error', description: 'Ingredient name and unit are required.' });
            return;
        }
        onSave({ 
            name,
            unit, 
            stock: Number(stock),
            costPerUnit: Number(costPerUnit), 
            expiryDate: expiryDate ? expiryDate.toISOString() : null,
            lowStockThreshold: Number(lowStockThreshold),
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{ingredient?.id ? 'Edit Ingredient' : 'Add New Ingredient'}</DialogTitle>
                    <DialogDescription>
                        {ingredient?.id ? 'Update the details of this ingredient.' : 'Fill in the details for the new ingredient.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="unit" className="text-right">Unit</Label>
                        <Input id="unit" placeholder="e.g., kg, L, pcs" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="costPerUnit" className="text-right">Cost/Unit (₦)</Label>
                        <Input id="costPerUnit" type="number" value={costPerUnit} onChange={(e) => setCostPerUnit(parseFloat(e.target.value))} className="col-span-3" disabled={isStorekeeper} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="stock" className="text-right">Stock</Label>
                        <Input id="stock" type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="col-span-3" disabled={!isDeveloper}/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="low-stock" className="text-right">Low Stock Threshold</Label>
                        <Input id="low-stock" type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Expiry Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "col-span-3 justify-start text-left font-normal",
                                !expiryDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {expiryDate ? format(expiryDate, "PPP") : <span>Pick a date (optional)</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={expiryDate}
                                onSelect={setExpiryDate}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>{ingredient?.id ? 'Save Changes' : 'Create Ingredient'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RequestStockDialog({ isOpen, onOpenChange, ingredients, suppliers, user }: { isOpen: boolean, onOpenChange: (open: boolean) => void, ingredients: Ingredient[], suppliers: Supplier[], user: User | null }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [ingredientId, setIngredientId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [quantity, setQuantity] = useState<number | string>('');

    const handleSubmit = async () => {
        if (!user || !ingredientId || !supplierId || !quantity || Number(quantity) <= 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select an ingredient, supplier, and enter a valid quantity.' });
            return;
        }
        setIsLoading(true);
        const result = await requestStockIncrease({ ingredientId, supplierId, quantity: Number(quantity) }, user);
        if (result.success) {
            toast({ title: 'Success', description: 'Stock request sent to accountant for approval.' });
            setIngredientId(''); setSupplierId(''); setQuantity('');
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <FileUp className="mr-2 h-4 w-4" /> Request Stock Increase
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Request Ingredient Stock Increase</DialogTitle>
                    <DialogDescription>Request a new delivery of ingredients. This will be sent to the accountant for cost approval before stock is updated.</DialogDescription>
                </DialogHeader>
                 <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Ingredient</Label>
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
                        <Label>Supplier</Label>
                        <Select value={supplierId} onValueChange={setSupplierId}>
                            <SelectTrigger><SelectValue placeholder="Select a supplier"/></SelectTrigger>
                            <SelectContent>
                                {suppliers.map(sup => (
                                    <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2">
                        <Label>Quantity Received</Label>
                        <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Send Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function LogDetailsDialog({ isOpen, onOpenChange, log, productionBatch, supplyLog }: { isOpen: boolean, onOpenChange: (open: boolean) => void, log: IngredientStockLog | null, productionBatch: ProductionBatch | null, supplyLog: SupplyLog | null }) {
    if (!isOpen || !log) return null;
  
    const isProduction = log.reason.startsWith('Production');
    const isPurchase = log.reason.startsWith('Purchase');
  
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Details: {log.id.substring(0, 7)}...</DialogTitle>
            <DialogDescription>
              Details for stock change on {format(new Date(log.date), 'PPp')} by {log.staffName}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {isProduction && productionBatch && (
              <div>
                <h4 className="font-semibold mb-2">Production Batch: {productionBatch.id.substring(0,6)}...</h4>
                <div className="text-sm space-y-1 mb-2">
                    <p><strong>Product:</strong> {productionBatch.productName} (x{productionBatch.quantityToProduce})</p>
                    <p><strong>Requested by:</strong> {productionBatch.requestedByName}</p>
                </div>
                <Separator className="my-2" />
                <h5 className="font-medium">Ingredients Used</h5>
                <Table>
                  <TableHeader>
                    <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead className="text-right">Available Before Prod</TableHead>
                        <TableHead className="text-right">Used</TableHead>
                        <TableHead className="text-right">Available After Prod</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionBatch.ingredients.map(ing => (
                      <TableRow key={ing.ingredientId}>
                        <TableCell>{ing.ingredientName}</TableCell>
                        <TableCell className="text-right">{((ing.openingStock || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {ing.unit}</TableCell>
                        <TableCell className="text-right text-red-500">- {ing.quantity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {ing.unit}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">{((ing.closingStock || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {ing.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {isPurchase && supplyLog && (
              <div>
                <h4 className="font-semibold mb-2">Purchase from: {supplyLog.supplierName}</h4>
                <div className="text-sm space-y-1">
                    <p><strong>Ingredient:</strong> {supplyLog.ingredientName}</p>
                    <p><strong>Quantity Received:</strong> {supplyLog.quantity} {supplyLog.unit}</p>
                    <p><strong>Cost per Unit:</strong> ₦{supplyLog.costPerUnit.toLocaleString()}</p>
                    <p><strong>Total Cost:</strong> ₦{supplyLog.totalCost.toLocaleString()}</p>
                    {supplyLog.invoiceNumber && <p><strong>Invoice #:</strong> {supplyLog.invoiceNumber}</p>}
                </div>
              </div>
            )}
            {!isProduction && !isPurchase && (
                <div className="text-sm">
                    <p><strong>Change:</strong> {log.change > 0 ? `+${log.change}` : log.change}</p>
                    <p><strong>Reason:</strong> {log.reason}</p>
                </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

export default function IngredientsPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [stockLogs, setStockLogs] = useState<IngredientStockLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null);
    const [isRequestStockOpen, setIsRequestStockOpen] = useState(false);
    
    const [date, setDate] = useState<DateRange | undefined>();
    const [tempDate, setTempDate] = useState<DateRange | undefined>();
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<IngredientStockLog | null>(null);
    const [selectedProductionBatch, setSelectedProductionBatch] = useState<ProductionBatch | null>(null);
    const [selectedSupplyLog, setSelectedSupplyLog] = useState<SupplyLog | null>(null);
    
    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        const unsubIngredients = onSnapshot(collection(db, "ingredients"), (snapshot) => {
            setIngredients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Ingredient[]);
            if(isLoading) setIsLoading(false);
        }, (error) => {
            console.error("Error fetching ingredients:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch ingredients data." });
        });

        const unsubSuppliers = onSnapshot(collection(db, "suppliers"), (snapshot) => {
            setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Supplier)));
        });

        getIngredientStockLogs().then(logsData => {
            setStockLogs(logsData);
        }).catch(error => {
            console.error("Error fetching stock logs:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch stock logs." });
        });
        
        return () => {
            unsubIngredients();
            unsubSuppliers();
        };
    }, [toast, isLoading]);

    const handleSaveIngredient = async (ingredientData: Partial<Omit<Ingredient, 'id'>>) => {
        try {
            if (editingIngredient && editingIngredient.id) {
                // Developers can edit everything, others cannot edit stock directly
                const finalData = (user?.role === 'Developer') ? ingredientData : { ...ingredientData, stock: editingIngredient.stock || 0 };
                await updateDoc(doc(db, "ingredients", editingIngredient.id), finalData);
                toast({ title: "Success", description: "Ingredient updated successfully." });
            } else {
                await addDoc(collection(db, "ingredients"), ingredientData);
                toast({ title: "Success", description: "Ingredient created successfully." });
            }
        } catch (error) {
            console.error("Error saving ingredient:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save ingredient." });
        }
    };

    const handleDeleteIngredient = async () => {
        if (!ingredientToDelete) return;
        try {
            await deleteDoc(doc(db, "ingredients", ingredientToDelete.id));
            toast({ title: "Success", description: "Ingredient deleted successfully." });
        } catch (error) {
            console.error("Error deleting ingredient:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete ingredient." });
        } finally {
            setIngredientToDelete(null);
        }
    };
    
    const openAddDialog = () => {
        setEditingIngredient({});
        setIsDialogOpen(true);
    };

    const openEditDialog = (ingredient: Ingredient) => {
        setEditingIngredient(ingredient);
        setIsDialogOpen(true);
    };

    const handleViewDetails = async (log: IngredientStockLog) => {
        setSelectedLog(log);
        setSelectedProductionBatch(null);
        setSelectedSupplyLog(null);
      
        if (log.logRefId) {
          if (log.reason.startsWith('Production')) {
            const batch = await getProductionBatch(log.logRefId);
            setSelectedProductionBatch(batch);
          } else if (log.reason.startsWith('Purchase')) {
            const supplyLog = await getSupplyLog(log.logRefId);
            setSelectedSupplyLog(supplyLog);
          }
        }
        setIsDetailsOpen(true);
      };

    const ingredientsWithTotal = useMemo(() => {
        return ingredients.map(ing => ({
            ...ing,
            totalCost: (ing.stock || 0) * (ing.costPerUnit || 0),
        }))
    }, [ingredients]);
    
    const grandTotalCost = useMemo(() => {
        return ingredientsWithTotal.reduce((acc, ing) => acc + ing.totalCost, 0);
    }, [ingredientsWithTotal]);

    const filteredLogs = useMemo(() => {
        if (!date?.from) return stockLogs;
        
        const fromDate = startOfDay(date.from);
        const toDate = date.to ? endOfDay(date.to) : endOfDay(date.from);
        
        return stockLogs.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= fromDate && logDate <= toDate;
        });
    }, [stockLogs, date]);

    const handleDateApply = () => {
        setDate(tempDate);
        setIsDatePopoverOpen(false);
    }

    const canManageIngredients = user?.role === 'Manager' || user?.role === 'Developer' || user?.role === 'Storekeeper';
    const isStorekeeper = user?.role === 'Storekeeper';
    const canViewFinancials = user?.role === 'Manager' || user?.role === 'Developer' || user?.role === 'Accountant';
    const canEditCost = user?.role !== 'Storekeeper';


    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold font-headline">Ingredients</h1>
                <div className="flex items-center gap-2">
                    {isStorekeeper && <RequestStockDialog isOpen={isRequestStockOpen} onOpenChange={setIsRequestStockOpen} ingredients={ingredients} suppliers={suppliers} user={user}/>}
                    {canManageIngredients && (
                        <Button onClick={openAddDialog}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Ingredient
                        </Button>
                    )}
                </div>
            </div>

            <IngredientDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleSaveIngredient}
                ingredient={editingIngredient}
                user={user}
            />
             <LogDetailsDialog 
                isOpen={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                log={selectedLog}
                productionBatch={selectedProductionBatch}
                supplyLog={selectedSupplyLog}
            />
            
            <Tabs defaultValue="current-stock">
                <TabsList>
                    <TabsTrigger value="current-stock">Current Stock</TabsTrigger>
                    <TabsTrigger value="stock-logs">Stock Logs</TabsTrigger>
                </TabsList>
                <TabsContent value="current-stock">
                    <Card>
                        <CardHeader>
                            <CardTitle>Manage Ingredients</CardTitle>
                            <CardDescription>
                                A list of all ingredients for your bakery's recipes.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ingredient</TableHead>
                                        <TableHead>Stock</TableHead>
                                        {canViewFinancials && <TableHead>Cost/Unit</TableHead>}
                                        {canViewFinancials && <TableHead>Total Cost</TableHead>}
                                        <TableHead>Expiry</TableHead>
                                        <TableHead><span className="sr-only">Actions</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={canViewFinancials ? 6 : 4} className="h-24 text-center">
                                                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                            </TableCell>
                                        </TableRow>
                                    ) : ingredientsWithTotal.length > 0 ? (
                                        ingredientsWithTotal.map(ingredient => (
                                            <TableRow key={ingredient.id} className={canManageIngredients ? "cursor-pointer" : ""} onClick={() => canManageIngredients && openEditDialog(ingredient)}>
                                                <TableCell className="font-medium">
                                                    {ingredient.name}
                                                    {(ingredient.stock < (ingredient.lowStockThreshold || 10)) && ingredient.stock > 0 && 
                                                        <Badge variant="secondary" className="ml-2">Low</Badge>
                                                    }
                                                    {ingredient.stock === 0 && 
                                                        <Badge variant="destructive" className="ml-2">Out</Badge>
                                                    }
                                                </TableCell>
                                                <TableCell>{(ingredient.stock || 0).toFixed(2)} {ingredient.unit}</TableCell>
                                                {canViewFinancials && <TableCell>₦{(ingredient.costPerUnit || 0).toFixed(2)}</TableCell>}
                                                {canViewFinancials && <TableCell>₦{ingredient.totalCost.toFixed(2)}</TableCell>}
                                                <TableCell>{ingredient.expiryDate ? new Date(ingredient.expiryDate).toLocaleDateString() : 'N/A'}</TableCell>
                                                <TableCell>
                                                   {canManageIngredients && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                                <span className="sr-only">Toggle menu</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onSelect={() => openEditDialog(ingredient)}>Edit</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive" onSelect={() => setIngredientToDelete(ingredient)}>Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                   )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={canViewFinancials ? 6 : 4} className="h-24 text-center">
                                                No ingredients found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                {canViewFinancials && (
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={3} className="font-bold text-right">Grand Total</TableCell>
                                            <TableCell className="font-bold">₦{grandTotalCost.toFixed(2)}</TableCell>
                                            <TableCell colSpan={2}></TableCell>
                                        </TableRow>
                                    </TableFooter>
                                )}
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="stock-logs">
                    <Card>
                        <CardHeader>
                             <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Ingredient Stock Logs</CardTitle>
                                    <CardDescription>A history of all stock movements.</CardDescription>
                                </div>
                                 <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                    <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                        "w-[260px] justify-start text-left font-normal",
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
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Ingredient</TableHead>
                                        <TableHead>Staff</TableHead>
                                        <TableHead>Change</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                                    ) : filteredLogs.length > 0 ? (
                                        filteredLogs.map(log => (
                                            <TableRow key={log.id} onClick={() => handleViewDetails(log)} className="cursor-pointer">
                                                <TableCell>{log.date ? format(new Date(log.date), 'Pp') : 'N/A'}</TableCell>
                                                <TableCell>{log.ingredientName}</TableCell>
                                                <TableCell>{log.staffName}</TableCell>
                                                <TableCell>
                                                    <Badge variant={log.change > 0 ? "default" : "destructive"} className="gap-1">
                                                        {log.change > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                                        {log.change.toLocaleString()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{log.reason}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" disabled={!log.logRefId}>
                                                        <Eye className="h-4 w-4"/>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No stock logs for this period.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!ingredientToDelete} onOpenChange={(open) => !open && setIngredientToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the ingredient "{ingredientToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteIngredient}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
