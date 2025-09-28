

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
import { MoreHorizontal, PlusCircle, Loader2 } from "lucide-react";
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
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addIndirectCost } from "@/app/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";


type OtherSupply = {
  id: string;
  name: string;
  stock: number;
  unit: string;
  costPerUnit: number;
  category: string;
  lowStockThreshold?: number;
};

const getStatusBadge = (stock: number, threshold?: number) => {
  const lowStock = threshold || 10;
  if (stock === 0) {
    return <Badge variant="destructive">Out of Stock</Badge>;
  }
  if (stock < lowStock) {
    return <Badge variant="secondary">Low Stock</Badge>;
  }
  return <Badge variant="outline">In Stock</Badge>;
};


function SupplyDialog({
  isOpen,
  onOpenChange,
  onSave,
  supply,
  user
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<OtherSupply, 'id'>) => void;
  supply: Partial<OtherSupply> | null;
  user: { role: string } | null;
}) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("");
    const [costPerUnit, setCostPerUnit] = useState(0);
    const [category, setCategory] = useState("Packaging");
    const [lowStockThreshold, setLowStockThreshold] = useState<number | string>(10);
    
    const isStorekeeper = user?.role === 'Storekeeper';


    useEffect(() => {
        if (supply) {
            setName(supply.name || "");
            setUnit(supply.unit || "");
            setCostPerUnit(supply.costPerUnit || 0);
            setCategory(supply.category || "Packaging");
            setLowStockThreshold(supply.lowStockThreshold || 10);
        } else {
            setName("");
            setUnit("");
            setCostPerUnit(0);
            setCategory("Packaging");
            setLowStockThreshold(10);
        }
    }, [supply]);

    const handleSubmit = () => {
        if (!name || !unit || !category) {
            toast({ variant: 'destructive', title: 'Error', description: 'Supply name, unit, and category are required.' });
            return;
        }
        onSave({ 
            name, 
            stock: supply?.stock || 0,
            unit, 
            costPerUnit: Number(costPerUnit), 
            category,
            lowStockThreshold: Number(lowStockThreshold),
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{supply?.id ? 'Edit Supply' : 'Add New Supply'}</DialogTitle>
                    <DialogDescription>
                        {supply?.id ? 'Update the details of this supply item.' : 'Fill in the details for the new supply item.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="unit" className="text-right">Unit</Label>
                        <Input id="unit" placeholder="e.g., pcs, L, rolls" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="costPerUnit" className="text-right">Cost/Unit (₦)</Label>
                        <Input id="costPerUnit" type="number" value={costPerUnit} onChange={(e) => setCostPerUnit(parseFloat(e.target.value))} className="col-span-3" disabled={isStorekeeper} />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="low-stock" className="text-right">Low Stock Threshold</Label>
                        <Input id="low-stock" type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Packaging">Packaging</SelectItem>
                                <SelectItem value="Cleaning">Cleaning</SelectItem>
                                <SelectItem value="Production">Production</SelectItem>
                                <SelectItem value="Office">Office</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>{supply?.id ? 'Save Changes' : 'Create Supply'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function IncreaseSupplyDialog({ supplies, onStockIncreased }: { supplies: OtherSupply[], onStockIncreased: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedSupplyId, setSelectedSupplyId] = useState('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    const selectedSupply = useMemo(() => supplies.find(s => s.id === selectedSupplyId), [supplies, selectedSupplyId]);
    const totalCost = useMemo(() => {
        if (selectedSupply && quantity) {
            return (selectedSupply.costPerUnit || 0) * Number(quantity);
        }
        return 0;
    }, [selectedSupply, quantity]);

    const handleSave = async () => {
        if (!selectedSupplyId || !quantity) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a supply and enter the quantity.' });
            return;
        }

        setIsLoading(true);
        const supply = supplies.find(s => s.id === selectedSupplyId);
        if (!supply) {
            toast({ variant: 'destructive', title: 'Error', description: 'Selected supply not found.' });
            setIsLoading(false);
            return;
        }

        try {
            const batch = writeBatch(db);

            // 1. Update stock for the supply
            const supplyRef = doc(db, 'other_supplies', selectedSupplyId);
            batch.update(supplyRef, { stock: increment(Number(quantity)) });

            // 2. Add an indirect cost entry
            await addIndirectCost({
                description: `Purchase of ${supply.name}`,
                category: 'Other Supplies',
                amount: totalCost,
            });
            
            await batch.commit();

            toast({ title: 'Success', description: 'Stock updated and cost logged.' });
            setSelectedSupplyId('');
            setQuantity('');
            onStockIncreased();
            setIsOpen(false);
        } catch (error) {
            console.error("Error increasing supply stock:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update stock.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Increase Supply Stock
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Increase Other Supply Stock</DialogTitle>
                    <DialogDescription>Record a purchase of a non-ingredient supply item.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Supply Item</Label>
                        <Select value={selectedSupplyId} onValueChange={setSelectedSupplyId}>
                            <SelectTrigger><SelectValue placeholder="Select an item" /></SelectTrigger>
                            <SelectContent>
                                {supplies.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (In Stock: {s.stock})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity Added</Label>
                        <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    {totalCost > 0 && (
                        <div className="font-medium text-sm">
                            Calculated Total Cost: ₦{totalCost.toLocaleString()}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Save and Update Stock
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function OtherSuppliesPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<{ role: string } | null>(null);
    const [supplies, setSupplies] = useState<OtherSupply[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingSupply, setEditingSupply] = useState<Partial<OtherSupply> | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [supplyToDelete, setSupplyToDelete] = useState<OtherSupply | null>(null);
    const [activeStockTab, setActiveStockTab] = useState("all");

    const fetchSupplies = useCallback(async () => {
        setIsLoading(true);
        try {
            const suppliesCollection = collection(db, "other_supplies");
            const snapshot = await getDocs(suppliesCollection);
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OtherSupply[];
            setSupplies(list);
        } catch (error) {
            console.error("Error fetching supplies:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch supplies." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, [])

    useEffect(() => {
        fetchSupplies();
        window.addEventListener('focus', fetchSupplies);
        return () => {
            window.removeEventListener('focus', fetchSupplies);
        };
    }, [fetchSupplies]);

    const handleSaveSupply = async (supplyData: Omit<OtherSupply, 'id'>) => {
        try {
            if (editingSupply && editingSupply.id) {
                const { stock, ...updateData } = supplyData;
                await updateDoc(doc(db, "other_supplies", editingSupply.id), updateData);
                toast({ title: "Success", description: "Supply updated successfully." });
            } else {
                await addDoc(collection(db, "other_supplies"), { ...supplyData, stock: 0 });
                toast({ title: "Success", description: "Supply created successfully." });
            }
            fetchSupplies();
        } catch (error) {
            console.error("Error saving supply:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save supply." });
        }
    };

    const handleDeleteSupply = async () => {
        if (!supplyToDelete) return;
        try {
            await deleteDoc(doc(db, "other_supplies", supplyToDelete.id));
            toast({ title: "Success", description: "Supply deleted successfully." });
            fetchSupplies();
        } catch (error) {
            console.error("Error deleting supply:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete supply." });
        } finally {
            setSupplyToDelete(null);
        }
    };
    
    const openAddDialog = () => {
        setEditingSupply({});
        setIsDialogOpen(true);
    };

    const openEditDialog = (supply: OtherSupply) => {
        setEditingSupply(supply);
        setIsDialogOpen(true);
    };
    
    const filteredSupplies = useMemo(() => {
        return supplies.filter(s => {
            if (activeStockTab === 'all') return true;
            const threshold = s.lowStockThreshold || 10;
            if (activeStockTab === 'in-stock') return s.stock >= threshold;
            if (activeStockTab === 'low-stock') return s.stock > 0 && s.stock < threshold;
            if (activeStockTab === 'out-of-stock') return s.stock === 0;
            return true;
        });
    }, [supplies, activeStockTab]);

    const grandTotalCost = useMemo(() => {
        return filteredSupplies.reduce((acc, supply) => acc + (supply.stock * supply.costPerUnit), 0);
    }, [filteredSupplies]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold font-headline">Other Supplies</h1>
                <div className="flex items-center gap-2">
                    <IncreaseSupplyDialog supplies={supplies} onStockIncreased={fetchSupplies} />
                     <Button onClick={openAddDialog} variant="outline">
                        Add New Supply Type
                    </Button>
                </div>
            </div>

            <SupplyDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleSaveSupply}
                supply={editingSupply}
                user={user}
            />

            <Card>
                <CardHeader>
                     <div className="overflow-x-auto pb-2">
                        <Tabs value={activeStockTab} onValueChange={setActiveStockTab}>
                        <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="in-stock">In Stock</TabsTrigger>
                            <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
                            <TabsTrigger value="out-of-stock">Out of Stock</TabsTrigger>
                        </TabsList>
                        </Tabs>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                        ) : filteredSupplies.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">No supplies found for this filter.</p>
                        ) : (
                            filteredSupplies.map(supply => (
                                <Card key={supply.id} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{supply.name}</p>
                                            <p className="text-sm text-muted-foreground">{supply.category}</p>
                                            <div className="mt-1">{getStatusBadge(supply.stock, supply.lowStockThreshold)}</div>
                                        </div>
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onSelect={() => openEditDialog(supply)}>Edit</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onSelect={() => setSupplyToDelete(supply)}>Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="mt-2 pt-2 border-t text-sm space-y-1">
                                        <div className="flex justify-between"><span>Stock:</span><span>{supply.stock.toFixed(2)} {supply.unit}</span></div>
                                        <div className="flex justify-between"><span>Cost/Unit:</span><span>₦{supply.costPerUnit.toFixed(2)}</span></div>
                                        <div className="flex justify-between font-bold"><span>Total Cost:</span><span>₦{(supply.stock * supply.costPerUnit).toFixed(2)}</span></div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supply Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead>Cost/Unit</TableHead>
                                    <TableHead>Total Cost</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSupplies.length > 0 ? (
                                    filteredSupplies.map(supply => (
                                        <TableRow key={supply.id}>
                                            <TableCell className="font-medium">{supply.name}</TableCell>
                                            <TableCell>{supply.category}</TableCell>
                                            <TableCell>{getStatusBadge(supply.stock, supply.lowStockThreshold)}</TableCell>
                                            <TableCell>{supply.stock.toFixed(2)} {supply.unit}</TableCell>
                                            <TableCell>₦{supply.costPerUnit.toFixed(2)}</TableCell>
                                            <TableCell>₦{(supply.stock * supply.costPerUnit).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onSelect={() => openEditDialog(supply)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive" onSelect={() => setSupplyToDelete(supply)}>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No supplies found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={5} className="font-bold text-right">Grand Total</TableCell>
                                    <TableCell className="font-bold">₦{grandTotalCost.toFixed(2)}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={!!supplyToDelete} onOpenChange={(open) => !open && setSupplyToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the supply "{supplyToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSupply}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

