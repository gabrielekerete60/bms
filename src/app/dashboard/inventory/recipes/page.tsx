
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, PlusCircle, Loader2, Trash2, CheckCircle, XCircle, Search, Eye, Edit, Rocket, CookingPot, CalendarIcon, Ban, BookCopy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { collection, onSnapshot, query, orderBy, where, doc, addDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startProductionBatch, approveIngredientRequest, declineProductionBatch, completeProductionBatch, ProductionBatch, ProductionLog, getRecipes, getProducts, getIngredients, getStaffByRole, getProductionBatch, getProductionLogs, handleSaveRecipe, handleDeleteRecipe, cancelProductionBatch, getProductionBatches } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import SelectLib from 'react-select';


type User = {
    name: string;
    role: string;
    staff_id: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
};

type Ingredient = {
    id: string;
    name: string;
    unit: string;
    stock: number;
    costPerUnit: number;
}

type RecipeIngredient = {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
};

type Recipe = {
  id: string;
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  applicableProductIds?: string[];
  isGeneralRecipe?: boolean;
};

type BatchItem = {
    productId: string;
    productName: string;
    quantity: number | string;
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


function CompleteBatchDialog({ batch, user, onBatchCompleted, products }: { batch: ProductionBatch, user: User, onBatchCompleted: () => void, products: Product[] }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [storekeepers, setStorekeepers] = useState<any[]>([]);
    const [producedItems, setProducedItems] = useState<BatchItem[]>([{ productId: '', productName: '', quantity: '' }]);
    const [wastedItems, setWastedItems] = useState<BatchItem[]>([]);
    const [recipeDetails, setRecipeDetails] = useState<Recipe | null>(null);
    
    useEffect(() => {
        if (isOpen) {
            const fetchDetails = async () => {
                const staff = await getStaffByRole('Storekeeper');
                setStorekeepers(staff);
                const recipeDoc = await getDoc(doc(db, "recipes", batch.recipeId));
                if (recipeDoc.exists()) {
                    setRecipeDetails({ id: recipeDoc.id, ...recipeDoc.data() } as Recipe);
                }
            };
            fetchDetails();
            setProducedItems([{ productId: '', productName: '', quantity: '' }]);
            setWastedItems([]);
        }
    }, [isOpen, batch.recipeId]);

    const handleItemChange = (index: number, field: keyof BatchItem, value: string, type: 'produced' | 'wasted') => {
        const setItems = type === 'produced' ? setProducedItems : setWastedItems;
        setItems(prevItems => {
            const newItems = [...prevItems];
            const currentItem = { ...newItems[index] };

            if (field === 'productId') {
                const product = products.find(p => p.id === value);
                currentItem.productId = value;
                currentItem.productName = product?.name || '';
            } else {
                currentItem.quantity = value;
            }
            newItems[index] = currentItem;
            return newItems;
        });
    }
    
    const handleAddItem = (type: 'produced' | 'wasted') => {
        const setItems = type === 'produced' ? setProducedItems : setWastedItems;
        setItems(prev => [...prev, { productId: '', productName: '', quantity: '' }]);
    }

    const handleRemoveItem = (index: number, type: 'produced' | 'wasted') => {
        const setItems = type === 'produced' ? setProducedItems : setWastedItems;
        setItems(prev => prev.filter((_, i) => i !== index));
    }


    const handleComplete = async () => {
        if (!storekeepers.length) {
            toast({ variant: 'destructive', title: 'Error', description: 'No Storekeeper found to transfer stock to. Please add a staff member with the "Storekeeper" role.' });
            return;
        }

        const finalProducedItems = producedItems.filter(p => p.productId && p.quantity && Number(p.quantity) > 0).map(p => ({ ...p, quantity: Number(p.quantity) }));
        const finalWastedItems = wastedItems.filter(p => p.productId && p.quantity && Number(p.quantity) > 0).map(p => ({ ...p, quantity: Number(p.quantity) }));

        if(finalProducedItems.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please add at least one produced item.'});
            return;
        }

        setIsLoading(true);
        if(!user) return;
        
        const result = await completeProductionBatch({
            batchId: batch.id,
            producedItems: finalProducedItems,
            wastedItems: finalWastedItems,
            storekeeperId: storekeepers[0].id // Assuming first storekeeper
        }, user);

        if (result.success) {
            toast({ title: 'Success', description: 'Production batch completed and sent for acknowledgement.' });
            onBatchCompleted();
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    }
    
    const getAvailableProducts = (type: 'produced' | 'wasted', index: number) => {
        const currentList = type === 'produced' ? producedItems : wastedItems;
        const selectedIds = new Set(currentList.map(item => item.productId).filter(id => id)); // Get all selected IDs in the current list
        
        const currentItem = currentList[index];

        const recipeProductIds = recipeDetails?.applicableProductIds || [];
        const isGeneral = recipeDetails?.isGeneralRecipe || false;

        return products.filter(p => 
            (isGeneral || recipeProductIds.includes(p.id)) &&
            (!selectedIds.has(p.id) || p.id === currentItem.productId) 
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button size="sm">Complete Batch</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Complete Production Batch</DialogTitle>
                    <DialogDescription>
                        Enter the final counts for batch <strong>{batch.id.substring(0,6)}...</strong>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    {/* Items Produced Section */}
                    <div className="space-y-2">
                        <Label>Items Produced</Label>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {producedItems.map((item, index) => (
                                <div key={`prod-${index}`} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
                                    <Select value={item.productId} onValueChange={(val) => handleItemChange(index, 'productId', val, 'produced')}>
                                        <SelectTrigger><SelectValue placeholder="Select Product" /></SelectTrigger>
                                        <SelectContent>
                                            {getAvailableProducts('produced', index).map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value, 'produced')} />
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index, 'produced')}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                         <Button variant="outline" size="sm" className="mt-2" onClick={() => handleAddItem('produced')}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                        </Button>
                    </div>
                    <Separator />
                    {/* Wasted Products Section */}
                     <div className="space-y-2">
                        <Label>Wasted Products (Optional)</Label>
                         <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {wastedItems.map((item, index) => (
                                <div key={`waste-${index}`} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
                                     <Select value={item.productId} onValueChange={(val) => handleItemChange(index, 'productId', val, 'wasted')}>
                                        <SelectTrigger><SelectValue placeholder="Select Product" /></SelectTrigger>
                                        <SelectContent>
                                            {getAvailableProducts('wasted', index).map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value, 'wasted')} />
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index, 'wasted')}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => handleAddItem('wasted')}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Wasted Product
                        </Button>
                    </div>

                    <p className="text-sm text-muted-foreground">Completed items will be sent to the main store for acknowledgement. Wasted items will be logged.</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleComplete} disabled={isLoading}>
                         {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Complete Batch
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ProductionLogDetailsDialog({ log, isOpen, onOpenChange, user }: { log: ProductionLog | null, isOpen: boolean, onOpenChange: (open: boolean) => void, user: User | null }) {
    const [batchDetails, setBatchDetails] = useState<ProductionBatch | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setBatchDetails(null);
            if (isOpen && log && log.action.includes('Batch') && log.details) {
                const batchIdMatch = log.details.match(/\b([a-zA-Z0-9]{20})\b/);
                const batchId = batchIdMatch ? batchIdMatch[0] : log.details.split(' ').pop();
                
                if (batchId) {
                    try {
                        const batch = await getProductionBatch(batchId);
                        setBatchDetails(batch);
                    } catch (error) {
                        console.error(`Could not fetch details for batch ${batchId}`, error)
                    }
                }
            }
        };
        fetchDetails();
    }, [isOpen, log]);
    
    if (!log || !isOpen || !user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log Details</DialogTitle>
          <DialogDescription>
            Detailed information for log entry on {log.timestamp ? format(new Date(log.timestamp), 'PPp') : 'N/A'}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4 text-sm max-h-[60vh] overflow-y-auto">
            <div className="flex items-center gap-2"><strong>Action:</strong> <Badge>{log.action}</Badge></div>
            <p><strong>Staff Member:</strong> {log.staffName}</p>
            <p><strong>Details:</strong> {log.details}</p>
            {batchDetails && user.role !== 'Baker' && (
                 <>
                    <Separator className="my-4"/>
                    <h4 className="font-semibold text-base">Production Batch Details</h4>
                    <p><strong>Product:</strong> {batchDetails.productName} (x{batchDetails.quantityToProduce})</p>
                    <p><strong>Requested by:</strong> {batchDetails.requestedByName}</p>
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead>Ingredient</TableHead>
                            <TableHead className="text-right">Available Before Prod</TableHead>
                            <TableHead className="text-right">Used</TableHead>
                            <TableHead className="text-right">Available After Prod</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {batchDetails.ingredients.map(ing => (
                                <TableRow key={ing.ingredientId}>
                                    <TableCell>{ing.ingredientName}</TableCell>
                                    <TableCell className="text-right">{((ing.openingStock || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {ing.unit}</TableCell>
                                    <TableCell className="text-right text-red-500">- {ing.quantity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {ing.unit}</TableCell>
                                    <TableCell className="text-right text-green-600 font-medium">{((ing.closingStock || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {ing.unit}</TableCell>
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
  );
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
                        Request for <strong>{batch.recipeName}</strong>. This will deduct ingredients from inventory.
                    </DialogDescription>
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
                <DialogFooter>
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
    );
}

function RecipeDialog({ onSave, allIngredients, allProducts, recipe, user, children }: { onSave: (data: Omit<Recipe, 'id'>, id?: string) => void, allIngredients: Ingredient[], allProducts: Product[], recipe?: Recipe | null, user: User, children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
    const [applicableProducts, setApplicableProducts] = useState<{ value: string, label: string }[]>([]);
    const [isGeneral, setIsGeneral] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if(isOpen) {
            if (recipe) {
                setName(recipe.name);
                setDescription(recipe.description);
                setIngredients(JSON.parse(JSON.stringify(recipe.ingredients)));
                setApplicableProducts(recipe.applicableProductIds?.map(id => {
                    const product = allProducts.find(p => p.id === id);
                    return { value: id, label: product?.name || 'Unknown Product' };
                }) || []);
                setIsGeneral(recipe.isGeneralRecipe || false);
            } else {
                setName('');
                setDescription('');
                setIngredients([{ ingredientId: '', ingredientName: '', quantity: 0, unit: '' }]);
                setApplicableProducts([]);
                setIsGeneral(false);
            }
        }
    }, [isOpen, recipe, allProducts]);
    
    const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: string) => {
        const newIngredients = [...ingredients];
        if (field === 'ingredientId') {
            const selectedIngredient = allIngredients.find(i => i.id === value);
            newIngredients[index] = {
                ...newIngredients[index],
                ingredientId: value,
                ingredientName: selectedIngredient?.name || '',
                unit: selectedIngredient?.unit || ''
            };
        } else if (field === 'quantity') {
            newIngredients[index].quantity = Number(value);
        }
        setIngredients(newIngredients);
    };

    const handleAddIngredient = () => {
        setIngredients([...ingredients, { ingredientId: '', ingredientName: '', quantity: 0, unit: '' }]);
    };
    
    const handleRemoveIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!name || ingredients.some(i => !i.ingredientId || i.quantity <= 0)) {
            toast({ variant: 'destructive', title: 'Error', description: 'Recipe name and all ingredient fields are required.' });
            return;
        }
        setIsSubmitting(true);
        const recipeData = {
            name,
            description,
            ingredients,
            applicableProductIds: applicableProducts.map(p => p.value),
            isGeneralRecipe: isGeneral,
        };
        const result = await handleSaveRecipe(recipeData, recipe?.id, user);
        if (result.success) {
            toast({ title: 'Success', description: 'Recipe saved successfully.' });
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    };
    
    const productOptions = useMemo(() => allProducts.map(p => ({ value: p.id, label: p.name })), [allProducts]);
    
    const customSelectStyles = {
        control: (styles: any) => ({ ...styles, backgroundColor: 'hsl(var(--input))', borderColor: 'hsl(var(--border))' }),
        menu: (styles: any) => ({ ...styles, backgroundColor: 'hsl(var(--popover))', zIndex: 9999 }),
        option: (styles: any, { isFocused }: any) => ({ ...styles, backgroundColor: isFocused ? 'hsl(var(--accent))' : undefined }),
        multiValue: (styles: any) => ({ ...styles, backgroundColor: 'hsl(var(--muted))' }),
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{recipe ? 'Edit Recipe' : 'Create New Recipe'}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
                    <div className="space-y-2">
                        <Label htmlFor="recipe-name">Recipe Name</Label>
                        <Input id="recipe-name" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="recipe-desc">Description</Label>
                        <Textarea id="recipe-desc" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label>Applicable Products</Label>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="general-recipe" checked={isGeneral} onCheckedChange={(checked) => setIsGeneral(checked as boolean)}/>
                            <label htmlFor="general-recipe" className="text-sm font-medium leading-none">
                                Applicable to all products
                            </label>
                        </div>
                        {!isGeneral && (
                             <SelectLib
                                isMulti
                                options={productOptions}
                                value={applicableProducts}
                                onChange={(selected) => setApplicableProducts(selected as any)}
                                styles={customSelectStyles}
                            />
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Ingredients</Label>
                        <div className="space-y-2">
                            {ingredients.map((ing, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Select value={ing.ingredientId} onValueChange={val => handleIngredientChange(index, 'ingredientId', val)}>
                                        <SelectTrigger><SelectValue placeholder="Select Ingredient" /></SelectTrigger>
                                        <SelectContent>
                                            {allIngredients.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Input type="number" placeholder="Qty" value={ing.quantity} onChange={e => handleIngredientChange(index, 'quantity', e.target.value)} className="w-28" />
                                    <span className="w-12 text-sm text-muted-foreground">{ing.unit}</span>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveIngredient(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={handleAddIngredient}><PlusCircle className="mr-2 h-4 w-4"/>Add Ingredient</Button>
                    </div>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Save Recipe
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function RecipesPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    
    // Real-time states
    const [productionBatches, setProductionBatches] = useState<{ pending: ProductionBatch[], in_production: ProductionBatch[], completed: ProductionBatch[], other: ProductionBatch[] }>({ pending: [], in_production: [], completed: [], other: [] });
    const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [viewingLog, setViewingLog] = useState<ProductionLog | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [logActionFilter, setLogActionFilter] = useState('all');
    const [logStaffFilter, setLogStaffFilter] = useState('all');
    const [logDate, setLogDate] = useState<DateRange | undefined>();
    const [visibleLogRows, setVisibleLogRows] = useState<number | 'all'>(10);
    const [isProductionDialogOpen, setIsProductionDialogOpen] = useState(false);

    const fetchStaticData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [recipeData, productData, ingredientData] = await Promise.all([
                getRecipes(),
                getProducts(),
                getIngredients(),
            ]);

            setRecipes(recipeData);
            setProducts(productData);
            setIngredients(ingredientData);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch static data." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        fetchStaticData();
    }, [fetchStaticData]);
    
    // Real-time listeners
    useEffect(() => {
        const unsubBatches = onSnapshot(query(collection(db, 'production_batches'), orderBy('createdAt', 'desc')), (snapshot) => {
            const allBatches = snapshot.docs.map(docSnap => {
                 const data = docSnap.data();
                return {
                    id: docSnap.id, ...data,
                    createdAt: (data.createdAt as any)?.toDate().toISOString(),
                    approvedAt: (data.approvedAt as any)?.toDate().toISOString(),
                    completedAt: (data.completedAt as any)?.toDate().toISOString(),
                } as ProductionBatch
            });
             setProductionBatches({
                pending: allBatches.filter(b => b.status === 'pending_approval'),
                in_production: allBatches.filter(b => b.status === 'in_production'),
                completed: allBatches.filter(b => b.status === 'completed'),
                other: allBatches.filter(b => ['declined', 'cancelled'].includes(b.status)),
            });
        });

        const unsubLogs = onSnapshot(query(collection(db, 'production_logs'), orderBy('timestamp', 'desc')), (snapshot) => {
             const logs = snapshot.docs.map(doc => {
                 const data = doc.data();
                 const timestamp = (data.timestamp as any)?.toDate ? (data.timestamp as any).toDate().toISOString() : data.timestamp;
                 return { id: doc.id, ...data, timestamp } as ProductionLog
             });
            setProductionLogs(logs);
        });

        return () => {
            unsubBatches();
            unsubLogs();
        }
    }, []);
    
    const handleStartProduction = async (recipe: Recipe) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Invalid input', description: 'User not found.' });
            return;
        }
        
        setIsSubmitting(true);

        const batchData = {
            recipeId: recipe.id,
            recipeName: recipe.name,
            productId: 'multi-product',
            productName: recipe.name,
            quantityToProduce: 1,
            batchSize: 'full' as 'full' | 'half',
        };
        
        const result = await startProductionBatch(batchData, user);
        if (result.success) {
            toast({ title: 'Success', description: 'Production batch requested for approval.'});
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error});
        }
        setIsSubmitting(false);
    }

    const handleCancelRequest = async (batchId: string) => {
        if (!user) return;
        setIsSubmitting(true);
        const result = await cancelProductionBatch(batchId, user);
        if (result.success) {
            toast({ title: 'Success', description: 'Production request has been cancelled.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    };

    const handleSaveRecipeAction = async (data: Omit<Recipe, 'id'>, id?: string) => {
        if (!user) return;
        const result = await handleSaveRecipe(data, id, user);
        if (result.success) {
            toast({ title: "Success", description: `Recipe "${data.name}" has been saved.` });
            fetchStaticData();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };
    
    const handleDeleteRecipeAction = async (recipe: Recipe) => {
        if (!user) return;
        const result = await handleDeleteRecipe(recipe.id, recipe.name, user);
        if (result.success) {
            toast({ title: "Success", description: `Recipe "${recipe.name}" has been deleted.` });
            fetchStaticData();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };


    const logStaffMembers = useMemo(() => ['all', ...new Set(productionLogs.map(log => log.staffName))], [productionLogs]);
    const logActionTypes = useMemo(() => ['all', ...new Set(productionLogs.map(log => log.action))], [productionLogs]);

    const filteredLogs = useMemo(() => {
        return productionLogs.filter(log => {
            const staffMatch = logStaffFilter === 'all' || log.staffName === logStaffFilter;
            const actionMatch = logActionFilter === 'all' || log.action === logActionFilter;
            
            let dateMatch = true;
            if (logDate?.from) {
                const from = startOfDay(logDate.from);
                const to = logDate.to ? endOfDay(logDate.to) : endOfDay(logDate.from);
                const logTimestamp = new Date(log.timestamp);
                dateMatch = logTimestamp >= from && logTimestamp <= to;
            }
            return staffMatch && actionMatch && dateMatch;
        });
    }, [productionLogs, logStaffFilter, logActionFilter, logDate]);

    const paginatedLogs = useMemo(() => {
        return visibleLogRows === 'all' ? filteredLogs : filteredLogs.slice(0, visibleLogRows);
    }, [filteredLogs, visibleLogRows]);
    
    if (!user) {
         return <div className="flex justify-center items-center h-full"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    const canApproveBatches = user.role === 'Manager' || user.role === 'Developer' || user.role === 'Storekeeper';
    const canCompleteBatches = user.role === 'Baker' || user.role === 'Chief Baker';
    const isBaker = user.role === 'Baker' || user.role === 'Chief Baker';
    const canStartProduction = isBaker || user.role === 'Developer';
    const canEditRecipe = user.role === 'Manager' || user.role === 'Developer';


    const getStatusVariant = (status: string) => {
        switch(status) {
            case 'pending_approval': return 'destructive';
            case 'in_production': return 'default';
            case 'completed': return 'outline';
            default: return 'secondary';
        }
    }

    const calculateRecipeCost = (recipe: Recipe) => {
        return recipe.ingredients.reduce((total, recipeIng) => {
            const ingredientData = ingredients.find(ing => ing.id === recipeIng.ingredientId);
            if(ingredientData) {
                return total + (recipeIng.quantity * (ingredientData.costPerUnit || 0));
            }
            return total;
        }, 0);
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold font-headline">Recipes &amp; Production</h1>
            </div>

            <ProductionLogDetailsDialog 
                log={viewingLog}
                isOpen={!!viewingLog}
                onOpenChange={() => setViewingLog(null)}
                user={user}
            />
            
            <Tabs defaultValue={isBaker ? 'production' : 'recipes'}>
                <TabsList>
                    {!isBaker && <TabsTrigger value="recipes">Recipes</TabsTrigger>}
                    <TabsTrigger value="production" className="relative">
                        Production Batches
                        {productionBatches.pending.length > 0 && (
                            <Badge variant="destructive" className="ml-2">{productionBatches.pending.length}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="logs">Production Logs</TabsTrigger>
                </TabsList>
                <TabsContent value="recipes" className="mt-4">
                     <Card>
                        <CardHeader className="flex flex-row justify-between items-start">
                            <div>
                                <CardTitle>Recipe Book</CardTitle>
                                <CardDescription>Manage all production recipes for the bakery.</CardDescription>
                            </div>
                            <RecipeDialog onSave={handleSaveRecipeAction} allIngredients={ingredients} allProducts={products} user={user}>
                                <Button disabled={!canEditRecipe}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Recipe
                                </Button>
                            </RecipeDialog>
                        </CardHeader>
                        <CardContent>
                             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {isLoading ? <Loader2 className="h-8 w-8 animate-spin"/> : (
                                    recipes.map(recipe => (
                                        <Card key={recipe.id}>
                                            <CardHeader>
                                                <CardTitle className="text-xl">{recipe.name}</CardTitle>
                                                <CardDescription>{recipe.description}</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-sm font-semibold mb-2">Total Ingredient Cost:</div>
                                                <p className="text-2xl font-bold text-primary">₦{calculateRecipeCost(recipe).toLocaleString()}</p>
                                            </CardContent>
                                            <CardFooter className="flex justify-between">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="sm" disabled={!canEditRecipe}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This will permanently delete the "{recipe.name}" recipe. This action cannot be undone.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteRecipeAction(recipe)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <RecipeDialog onSave={handleSaveRecipeAction} allIngredients={ingredients} allProducts={products} recipe={recipe} user={user}>
                                                    <Button variant="outline" size="sm" disabled={!canEditRecipe}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                                                </RecipeDialog>
                                            </CardFooter>
                                        </Card>
                                    ))
                                )}
                             </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="production" className="mt-4">
                     <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div>
                                <CardTitle>Production Queue</CardTitle>
                                <CardDescription>Manage and track all production batches.</CardDescription>
                            </div>
                             {canStartProduction && (
                                <Dialog open={isProductionDialogOpen} onOpenChange={setIsProductionDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button>
                                            <CookingPot className="mr-2 h-4 w-4" /> Start Production Batch
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Start Production</DialogTitle>
                                            <DialogDescription>Choose a recipe to start a production batch. This will send a request for approval.</DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4 space-y-4">
                                            {recipes.map(recipe => (
                                                <Card key={recipe.id} className="p-4 flex justify-between items-center">
                                                    <div>
                                                        <p className="font-semibold">{recipe.name}</p>
                                                        <p className="text-sm text-muted-foreground">{recipe.ingredients.length} ingredients</p>
                                                    </div>
                                                    <Button onClick={() => handleStartProduction(recipe)}>Start Batch</Button>
                                                </Card>
                                            ))}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                             )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                { title: 'Pending Approval', batches: productionBatches.pending },
                                { title: 'In Production', batches: productionBatches.in_production },
                                { title: 'Completed & Returned', batches: productionBatches.completed },
                                { title: 'Declined / Cancelled', batches: productionBatches.other }
                            ].map(section => (
                                (isBaker || section.batches.length > 0) && (
                                <div key={section.title}>
                                    <h3 className="font-semibold mb-2">{section.title} ({section.batches.length})</h3>
                                    <div className="border rounded-md">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Recipe</TableHead><TableHead>Requested By</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {section.batches.length > 0 ? section.batches.map(batch => (
                                                <TableRow key={batch.id} onClick={() => { if(!isBaker) setViewingLog({ action: 'Batch Details', details: `Details for batch ${batch.id}`, staffId: batch.requestedById, staffName: batch.requestedByName, timestamp: batch.createdAt, id: batch.id })}} className={cn(!isBaker && "cursor-pointer")}>
                                                    <TableCell>{format(new Date(batch.createdAt), 'Pp')}</TableCell>
                                                    <TableCell>{batch.recipeName}</TableCell>
                                                    <TableCell>{batch.requestedByName}</TableCell>
                                                    <TableCell><Badge variant={getStatusVariant(batch.status)}>{batch.status.replace(/_/g, ' ')}</Badge></TableCell>
                                                    <TableCell>
                                                        {batch.status === 'pending_approval' && canApproveBatches && (
                                                            <ApproveBatchDialog batch={batch} user={user} allIngredients={ingredients} onApproval={fetchStaticData} />
                                                        )}
                                                         {batch.status === 'pending_approval' && isBaker && (
                                                            <Button size="sm" variant="destructive" onClick={() => handleCancelRequest(batch.id)} disabled={isSubmitting}><Ban className="mr-2 h-4 w-4"/> Cancel</Button>
                                                        )}
                                                        {batch.status === 'in_production' && canCompleteBatches && (
                                                            <CompleteBatchDialog batch={batch} user={user} onBatchCompleted={fetchStaticData} products={products} />
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )) : <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No batches in this stage.</TableCell></TableRow>}
                                        </TableBody>
                                    </Table>
                                    </div>
                                </div>
                                )
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="logs" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Production Logs</CardTitle>
                             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4">
                                <CardDescription>A complete audit trail of all recipe and production activities.</CardDescription>
                                <div className="flex flex-wrap items-center gap-2">
                                     {!isBaker && (
                                         <Select value={logStaffFilter} onValueChange={setLogStaffFilter}>
                                            <SelectTrigger className="w-full sm:w-[180px]">
                                                <SelectValue placeholder="Filter by staff" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {logStaffMembers.map(staff => (
                                                    <SelectItem key={staff} value={staff} className="capitalize">{staff}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                     )}
                                    <Select value={logActionFilter} onValueChange={setLogActionFilter}>
                                        <SelectTrigger className="w-full sm:w-[180px]">
                                            <SelectValue placeholder="Filter by action" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {logActionTypes.map(action => (
                                                <SelectItem key={action} value={action}>{action}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <DateRangeFilter date={logDate} setDate={setLogDate} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Staff</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead><TableHead>View</TableHead></TableRow></TableHeader>
                                <TableBody>
                                     {paginatedLogs.length > 0 ? paginatedLogs.map(log => (
                                        <TableRow key={log.id} className="cursor-pointer" onClick={() => setViewingLog(log)}>
                                            <TableCell>{log.timestamp ? format(new Date(log.timestamp), 'Pp') : 'N/A'}</TableCell>
                                            <TableCell>{log.staffName}</TableCell>
                                            <TableCell><Badge>{log.action}</Badge></TableCell>
                                            <TableCell className="max-w-[300px] truncate">{log.details}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setViewingLog(log); }}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={5} className="text-center h-24">No production logs found for this filter.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                        <CardFooter>
                            <PaginationControls visibleRows={visibleLogRows} setVisibleRows={setVisibleLogRows} totalRows={filteredLogs.length} />
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
