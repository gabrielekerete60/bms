
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
  category: string;
  image: string;
  "data-ai-hint": string;
  costPrice?: number;
  lowStockThreshold?: number;
  minPrice?: number;
  maxPrice?: number;
};

type User = {
    role: string;
}

interface ProductEditDialogProps {
    product: Product | null;
    onOpenChange: (open: boolean) => void;
    onProductUpdate: () => void;
    user: User | null;
    categories: string[];
}

export function ProductEditDialog({ product, onOpenChange, onProductUpdate, user, categories }: ProductEditDialogProps) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [costPrice, setCostPrice] = useState(0);
    const [price, setPrice] = useState(0);
    const [minPrice, setMinPrice] = useState<number | string>('');
    const [maxPrice, setMaxPrice] = useState<number | string>('');
    const [lowStockThreshold, setLowStockThreshold] = useState<number | string>(20);

    const isDeveloper = user?.role === 'Developer';
    const isOpen = product !== null;

    useEffect(() => {
        if (product) {
            setName(product.name || "");
            setCategory(product.category || "");
            setCostPrice(product.costPrice || 0);
            setPrice(product.price || 0);
            setMinPrice(product.minPrice || '');
            setMaxPrice(product.maxPrice || '');
            setLowStockThreshold(product.lowStockThreshold || 20);
        }
    }, [product]);

    const handleSubmit = async () => {
        if (!product) return;

        const productData = {
            name,
            category,
            costPrice: Number(costPrice),
            price: Number(price),
            minPrice: Number(minPrice) || Number(price),
            maxPrice: Number(maxPrice) || Number(price),
            lowStockThreshold: Number(lowStockThreshold),
        };
        
        try {
            const productRef = doc(db, "products", product.id);
            await updateDoc(productRef, productData);
            toast({ title: "Success", description: "Product updated successfully." });
            onProductUpdate();
            onOpenChange(false);
        } catch (error) {
            console.error("Error updating product:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update product." });
        }
    };

    if (!isDeveloper) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Product: {product?.name}</DialogTitle>
                    <DialogDescription>
                        Developers can make quick edits here. Changes affect all inventories.
                    </DialogDescription>
                </DialogHeader>
                 <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-name" className="text-right">Name</Label>
                        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-category" className="text-right">Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.filter(c => c !== 'All').map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-costPrice">Cost Price (₦)</Label>
                            <Input id="edit-costPrice" type="number" value={costPrice} onChange={(e) => setCostPrice(parseFloat(e.target.value))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-price">Selling Price (₦)</Label>
                            <Input id="edit-price" type="number" value={price} onChange={(e) => setPrice(parseFloat(e.target.value))} />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-minPrice">Min Price (₦)</Label>
                            <Input id="edit-minPrice" type="number" placeholder="e.g. 500" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-maxPrice">Max Price (₦)</Label>
                            <Input id="edit-maxPrice" type="number" placeholder="e.g. 600" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-low-stock">Low Stock Threshold</Label>
                        <Input id="edit-low-stock" type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

