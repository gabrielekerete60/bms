
"use client";

import React, { useState, useMemo, useEffect, useRef, Suspense, useCallback } from "react";
import Image from "next/image";
import { Plus, Minus, X, Search, Trash2, Hand, CreditCard, Printer, User, Building, Loader2, Wallet, ArrowRightLeft, Edit } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { collection, getDocs, doc, runTransaction, increment, getDoc, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handlePosSale, initializePaystackTransaction, verifyPaystackOnServerAndFinalizeOrder, getProductsForStaff } from "@/app/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User, CartItem, Product, CompletedOrder, SelectableStaff } from "./types";
import type PaystackPop from '@paystack/inline-js';
import { ProductEditDialog } from "@/app/dashboard/components/product-edit-dialog";


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
                        <TableRow key={item.id || index}>
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
    )
});
Receipt.displayName = 'Receipt';


const handlePrint = (node: HTMLElement | null) => {
    if (!node) return;
    const printWindow = window.open('', '_blank', 'width=320,height=500');
    if (printWindow) {
        const receiptContent = node.innerHTML;
        const printableContent = `
            <html>
                <head>
                    <title>Receipt</title>
                    <style>
                        @media print {
                            @page {
                                margin: 0;
                                size: 80mm auto;
                            }
                            body { 
                                font-family: sans-serif; 
                                margin: 0;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${receiptContent}
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

function POSPageContent() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [cart, setCart] = useLocalStorage<CartItem[]>('posCart', []);
  const [heldOrders, setHeldOrders] = useLocalStorage<CartItem[][]>('heldOrders', []);
  const [activeTab, setActiveTab] = useState('All');
  const [customerType, setCustomerType] = useState<'walk-in' | 'registered'>('walk-in');
  const [customerName, setCustomerName] = useLocalStorage('posCustomerName', '');
  const [customerEmail, setCustomerEmail] = useLocalStorage('posCustomerEmail', '');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<CompletedOrder | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmMethod, setConfirmMethod] = useState<'Cash' | 'POS' | null>(null);
  const [storeAddress, setStoreAddress] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed' | 'cancelled'>('idle');

  const [allStaff, setAllStaff] = useState<SelectableStaff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useLocalStorage<string | null>('posSelectedStaff', null);
  const [isStaffSelectionOpen, setIsStaffSelectionOpen] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);

  const [hasMounted, setHasMounted] = useState(false);
    useEffect(() => {
        setHasMounted(true);
    }, []);

  const total = useMemo(() => cart.reduce((acc, item) => acc + item.price * item.quantity, 0), [cart]);

  const fetchProductsForStaff = useCallback(async (staffId: string) => {
    setIsLoadingProducts(true);
    
    return onSnapshot(collection(db, 'staff', staffId, 'personal_stock'), async (stockSnapshot) => {
        if (stockSnapshot.empty) {
            setProducts([]);
            setIsLoadingProducts(false);
            return;
        }

        const productDetailsPromises = stockSnapshot.docs.map(stockDoc => {
            const productId = stockDoc.data().productId;
            return getDoc(doc(db, 'products', productId));
        });
        const productDetailsSnapshots = await Promise.all(productDetailsPromises);
        
        const productsList = stockSnapshot.docs.map((stockDoc, index) => {
            const stockData = stockDoc.data();
            const productDetailsDoc = productDetailsSnapshots[index];
            
            if (productDetailsDoc.exists()) {
                const productDetails = productDetailsDoc.data();
                return {
                    id: productDetailsDoc.id,
                    name: productDetails.name,
                    price: productDetails.price,
                    stock: stockData.stock,
                    category: productDetails.category,
                    image: productDetails.image,
                    'data-ai-hint': productDetails['data-ai-hint'],
                    costPrice: productDetails.costPrice || 0,
                    minPrice: productDetails.minPrice,
                    maxPrice: productDetails.maxPrice,
                    lowStockThreshold: productDetails.lowStockThreshold
                } as Product;
            }
            return null;
        }).filter((p): p is Product => p !== null && p.stock > 0);

        setProducts(productsList);
        setIsLoadingProducts(false);
    });
  }, []);

  const clearCartAndStorage = useCallback(() => {
    setCart([]);
    setCustomerName('');
    setCustomerEmail('');
  }, [setCart, setCustomerName, setCustomerEmail]);
  
  const handleSaleMade = useCallback((order: CompletedOrder) => {
      setLastCompletedOrder(order);
      setIsReceiptOpen(true);
      clearCartAndStorage();
      setPaymentStatus('idle');
      setIsCheckoutOpen(false);
  }, [clearCartAndStorage]);

  useEffect(() => {
    const initializePos = async () => {
      const storedUser = localStorage.getItem('loggedInUser');
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);

        const adminRoles = ['Manager', 'Developer'];
        if (adminRoles.includes(parsedUser.role)) {
          const staffQuery = query(collection(db, "staff"), where("role", "==", "Showroom Staff"));
          const staffSnapshot = await getDocs(staffQuery);
          setAllStaff(staffSnapshot.docs.map(d => ({ staff_id: d.id, ...d.data() } as SelectableStaff)));
          if (!selectedStaffId) {
            setIsStaffSelectionOpen(true);
          }
        } else {
          setSelectedStaffId(parsedUser.staff_id);
        }
      }
      const settingsDoc = await getDoc(doc(db, 'settings', 'app_config'));
      if (settingsDoc.exists()) {
          setStoreAddress(settingsDoc.data().storeAddress);
      }
    };
    initializePos();
  }, [selectedStaffId]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    if (selectedStaffId) {
        fetchProductsForStaff(selectedStaffId).then(unsub => {
            unsubscribe = unsub;
        });
    } else {
        setProducts([]);
        setIsLoadingProducts(false);
    }
    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [selectedStaffId, fetchProductsForStaff])
  
  useEffect(() => {
    if (isReceiptOpen && lastCompletedOrder) {
      setTimeout(() => {
        handlePrint(receiptRef.current);
      }, 100);
    }
  }, [isReceiptOpen, lastCompletedOrder]);
  
  
  const handleOfflinePayment = async (method: 'Cash' | 'POS') => {
    setIsConfirmOpen(false);
    setPaymentStatus('processing');
    setIsCheckoutOpen(false);

    if (!user || !selectedStaffId) {
        toast({ variant: "destructive", title: "Error", description: "User or operating staff not identified. Cannot complete order." });
        setPaymentStatus('idle');
        return;
    }
    
    const itemsWithCost = cart.map(item => {
        const productDetails = products.find(p => p.id === item.id);
        return {
            productId: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            costPrice: productDetails?.costPrice || 0
        };
    });

    const staffDoc = await getDoc(doc(db, "staff", selectedStaffId));
    const staffName = staffDoc.exists() ? staffDoc.data().name : 'Unknown';

    const saleData = {
        items: itemsWithCost,
        total,
        paymentMethod: method,
        customerName: customerName || 'Walk-in',
        staffId: selectedStaffId,
        staffName: staffName,
        date: new Date().toISOString()
    };
    
    const result = await handlePosSale(saleData);

    if (result.success && result.orderId) {
        const completedOrder: CompletedOrder = {
            id: result.orderId,
            items: cart,
            total: total,
            date: new Date().toISOString(),
            paymentMethod: method,
            customerName: customerName || 'Walk-in',
            status: 'Completed',
            subtotal: 0, // Placeholder
            tax: 0, // Placeholder
        };
        handleSaleMade(completedOrder);
        toast({ title: 'Sale Recorded', description: 'Order has been successfully recorded.' });
    } else {
         toast({
            variant: "destructive",
            title: "Order Failed",
            description: result.error || "Could not complete the sale.",
        });
        setPaymentStatus('idle');
    }
  }

  const handlePaystackPayment = async () => {
    if (!user || !selectedStaffId) return;

    const selectedStaff = allStaff.find(s => s.staff_id === selectedStaffId) || user;
    if (!selectedStaff) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not identify the operating staff member.'});
        return;
    }

    setPaymentStatus('processing');
    setIsCheckoutOpen(false);

    const itemsWithCost = cart.map(item => {
        const productDetails = products.find(p => p.id === item.id);
        return {
            productId: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            costPrice: productDetails?.costPrice || 0,
        };
    });

    const initResult = await initializePaystackTransaction({
        email: customerEmail || user.email,
        total: total,
        customerName: customerName || 'Walk-in',
        staffId: selectedStaffId,
        staffName: selectedStaff.name,
        items: itemsWithCost,
        isPosSale: true,
        isDebtPayment: false,
    });
    
    if (initResult.success && initResult.reference) {
        const PaystackPop = (await import('@paystack/inline-js')).default;
        const paystack = new PaystackPop();
        
        paystack.newTransaction({
            key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
            email: customerEmail || user.email,
            amount: Math.round(total * 100),
            ref: initResult.reference,
            onSuccess: async (transaction) => {
                setPaymentStatus('processing'); // Keep it processing during verification
                const verifyResult = await verifyPaystackOnServerAndFinalizeOrder(transaction.reference);
                if (verifyResult.success && verifyResult.orderId) {
                    const completedOrder: CompletedOrder = {
                        id: verifyResult.orderId,
                        items: cart,
                        total,
                        date: new Date().toISOString(),
                        paymentMethod: 'Paystack',
                        customerName: customerName || 'Walk-in',
                        status: 'Completed',
                        subtotal: 0, // Placeholder
                        tax: 0, // Placeholder
                    };
                    handleSaleMade(completedOrder);
                    toast({ title: "Payment Successful", description: "Order has been verified and completed." });
                    setPaymentStatus('success');
                } else {
                    toast({ variant: "destructive", title: "Verification Failed", description: verifyResult.error || "Could not verify payment. Please contact support." });
                    setPaymentStatus('failed');
                }
            },
            onClose: () => {
                if (paymentStatus !== 'success') {
                    toast({ variant: "destructive", title: "Payment Cancelled", description: "The payment window was closed." });
                    setPaymentStatus('cancelled');
                }
            }
        });
    } else {
        toast({ variant: 'destructive', title: 'Error', description: initResult.error || 'Could not initialize payment.' });
        setPaymentStatus('failed');
    }
  }

  const categories = ['All', ...new Set(products.map(p => p.category))];
  
  const filteredProducts = useMemo(() => {
    let productsToFilter = products;
    if (activeTab !== 'All') {
        productsToFilter = productsToFilter.filter(p => p.category === activeTab);
    }
    if (searchTerm) {
        productsToFilter = productsToFilter.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return productsToFilter;
  }, [activeTab, products, searchTerm]);


  const addToCart = (product: Product) => {
    const productInStock = products.find(p => p.id === product.id);
    if (!productInStock || productInStock.stock === 0) {
      toast({
        variant: "destructive",
        title: "Out of Stock",
        description: `${product.name} is currently unavailable in this inventory.`,
      });
      return;
    };
    
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        if(existingItem.quantity >= productInStock.stock) {
            toast({ variant: "destructive", title: "Stock Limit Reached", description: `Cannot add more ${product.name}.` });
            return prevCart;
        }
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, price: productInStock.price, costPrice: productInStock.costPrice } // Always update price & costPrice
            : item
        );
      }
      return [...prevCart, { id: product.id, name: product.name, price: product.price, quantity: 1, costPrice: productInStock.costPrice }];
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    setCart((prevCart) => {
      if (newQuantity <= 0) {
        return prevCart.filter((item) => item.id !== productId);
      }
      const productInStock = products.find(p => p.id === productId);
      if (productInStock && newQuantity > productInStock.stock) {
        toast({ variant: "destructive", title: "Stock Limit Reached", description: `Only ${productInStock.stock} units of ${productInStock.name} available.` });
        return prevCart.map((item) => item.id === productId ? { ...item, quantity: productInStock.stock } : item);
      }
      return prevCart.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
    });
  };
  
  const clearCart = () => {
    if (cart.length === 0) return;
    clearCartAndStorage();
    toast({
        title: "Cart Cleared",
        description: "All items have been removed from the cart.",
    });
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    setHeldOrders(prev => [...prev, cart]);
    clearCartAndStorage();
     toast({
        title: "Order Held",
        description: "The current cart has been saved.",
    });
  }

  const resumeOrder = (orderIndex: number) => {
    if (cart.length > 0) {
       toast({
        variant: "destructive",
        title: "Cart is not empty",
        description: "Please clear or complete the current order before resuming another.",
      });
      return;
    }
    const orderToResume = heldOrders[orderIndex];
    setCart(orderToResume);
    setHeldOrders(prev => prev.filter((_, index) => index !== orderIndex));
    setActiveTab('All');
  }

  const handleSelectStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    setIsStaffSelectionOpen(false);
  }

  const selectedStaffName = allStaff.find(s => s.staff_id === selectedStaffId)?.name || user?.name;


  return (
     <>
     <div className="flex flex-col xl:flex-row gap-6 h-full print:hidden">
      {/* Products Section */}
      <div className="flex-grow xl:w-2/3">
        <Card className="flex flex-col h-full">
            <CardContent className="p-4 flex flex-col gap-4 flex-grow">
            <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-headline">Point of Sale</h1>
                    {selectedStaffId && (
                        <div 
                        className={cn("text-sm text-muted-foreground", (user?.role === 'Manager' || user?.role === 'Developer') && "hover:text-primary cursor-pointer")}
                        onClick={() => user?.role === 'Manager' || user?.role === 'Developer' ? setIsStaffSelectionOpen(true) : null}
                        >
                        Operating as: <span className="font-semibold">{selectedStaffName}</span>
                        </div>
                    )}
                </div>
                <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input placeholder="Search products..." className="pl-10 w-full sm:w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
            </header>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-grow">
                <div className="overflow-x-auto pb-2">
                    <TabsList>
                        {categories.map(category => (
                            <TabsTrigger key={category} value={category} disabled={!selectedStaffId}>
                                {category}
                            </TabsTrigger>
                        ))}
                        <TabsTrigger value="held-orders" className="flex gap-2" disabled={!selectedStaffId}>
                            Held Orders <Badge>{heldOrders.length}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value={activeTab} className="mt-4 flex-grow">
                    <ScrollArea className="h-[calc(100vh_-_24rem)] xl:h-auto">
                        {isLoadingProducts ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            filteredProducts.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pr-4">
                                {filteredProducts.map((product) => (
                                    <Card
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className={`cursor-pointer hover:shadow-lg transition-shadow group relative overflow-hidden ${product.stock === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        <CardContent className="p-0">
                                            <Image
                                            src={product.image}
                                            alt={product.name}
                                            width={150}
                                            height={150}
                                            className="rounded-t-lg object-cover w-full aspect-square transition-transform group-hover:scale-105"
                                            data-ai-hint={product['data-ai-hint']}
                                            />
                                            {user?.role === 'Developer' && (
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="absolute top-2 left-2 h-7 w-7 opacity-0 group-hover:opacity-100"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingProduct(product);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Badge variant="secondary" className="absolute top-2 right-2">
                                                Stock: {product.stock}
                                            </Badge>
                                            {product.stock === 0 && (
                                                <div className="absolute inset-0 bg-card/80 flex items-center justify-center rounded-lg">
                                                    <p className="font-bold text-lg text-destructive">Out of Stock</p>
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter className="p-3 flex flex-col items-start bg-muted/50">
                                            <h3 className="font-semibold text-sm">{product.name}</h3>
                                            <p className="text-sm text-primary font-bold">₦{product.price.toFixed(2)}</p>
                                        </CardFooter>
                                    </Card>
                                ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <p>{selectedStaffId ? "No products found for this filter." : "Select a staff member to begin."}</p>
                                </div>
                            )
                        )}
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="held-orders" className="mt-4">
                    <ScrollArea className="h-[calc(100vh_-_22rem)] xl:h-auto">
                        {heldOrders.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <p>No orders on hold.</p>
                        </div>
                        ) : (
                        <div className="space-y-2 pr-4">
                            {heldOrders.map((heldCart, index) => (
                           <Card key={index} className="p-2 flex justify-between items-center">
                              <div>
                                <p className="font-semibold">Held Order #{index + 1}</p>
                                <p className="text-sm text-muted-foreground">{heldCart.length} items - Total: ₦{heldCart.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2)}</p>
                              </div>
                              <Button size="sm" onClick={() => resumeOrder(index)}>Resume</Button>
                           </Card>
                            ))}
                        </div>
                        )}
                    </ScrollArea>
                </TabsContent>
            </Tabs>
            </CardContent>
        </Card>
      </div>

      {/* Order Summary Section */}
       <div className="xl:w-1/3 xl:min-w-[450px]">
            <Card className="flex flex-col h-full">
                <CardContent className="p-4 flex flex-col gap-4 flex-grow">
                <h2 className="text-xl font-bold font-headline mb-2">Current Order</h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant={customerType === 'walk-in' ? 'default' : 'outline'} onClick={() => setCustomerType('walk-in')}>
                                <User className="mr-2 h-4 w-4" />
                                Walk-in
                            </Button>
                            <Button variant={customerType === 'registered' ? 'default' : 'outline'} onClick={() => setCustomerType('registered')}>
                                <Building className="mr-2 h-4 w-4" />
                                Registered
                            </Button>
                        </div>
                        {customerType === 'walk-in' && (
                            <div className="space-y-1.5">
                                <Label htmlFor="customer-name">Customer Name (Optional)</Label>
                                <Input id="customer-name" placeholder="Enter name for walk-in" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                            </div>
                        )}
                        {customerType === 'registered' && (
                            <div className="space-y-1.5">
                                <Label htmlFor="customer-search">Search Registered Customer</Label>
                                <Input id="customer-search" placeholder="Search by name or phone..." />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label htmlFor="customer-email">Customer Email (for receipt)</Label>
                            <Input id="customer-email" placeholder="customer@example.com" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                        </div>
                    </div>
                    <Separator />
                
                <ScrollArea className="flex-grow -mr-4 pr-4 mb-4 min-h-[150px]">
                    {cart.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>Click on a product to add it to the order.</p>
                    </div>
                    ) : (
                    <div className="space-y-4">
                        {cart.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 text-sm">
                            <div className="flex-grow">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-muted-foreground">₦{item.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-bold w-4 text-center">{item.quantity}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                            </div>
                            <p className="font-semibold w-16 text-right">₦{(item.price * item.quantity).toFixed(2)}</p>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive/70 hover:text-destructive"
                                onClick={() => updateQuantity(item.id, 0)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        ))}
                    </div>
                    )}
                </ScrollArea>
                </CardContent>

                <CardFooter className="p-4 flex flex-col gap-4 border-t bg-muted/20">
                    <div className="w-full space-y-2 text-sm">
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>₦{total.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <Button variant="outline" onClick={holdOrder} disabled={cart.length === 0 || !selectedStaffId || paymentStatus === 'processing'}>
                            <Hand /> Hold
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={cart.length === 0 || !selectedStaffId || paymentStatus === 'processing'}>
                                    <Trash2/> Clear
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will clear all items from the current cart. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={clearCart}>Yes, Clear Cart</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <Button size="lg" className="w-full font-bold text-lg" disabled={cart.length === 0 || !selectedStaffId || paymentStatus === 'processing'} onClick={() => setIsCheckoutOpen(true)}>
                        {paymentStatus === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {paymentStatus === 'processing' ? 'Processing...' : 'Checkout'}
                    </Button>
                </CardFooter>
            </Card>
       </div>
      </div>

       {/* ---- DIALOGS ---- */}
       <ProductEditDialog
          product={editingProduct}
          onOpenChange={setEditingProduct}
          onProductUpdate={() => selectedStaffId && fetchProductsForStaff(selectedStaffId)}
          user={user}
          categories={categories}
        />

        {/* Manager Staff Selection Dialog */}
        <Dialog open={isStaffSelectionOpen} onOpenChange={setIsStaffSelectionOpen}>
            <DialogContent onInteractOutside={(e) => {
                if(!selectedStaffId) e.preventDefault();
            }}>
                <DialogHeader>
                    <DialogTitle>Select Staff POS</DialogTitle>
                    <DialogDescription>
                        Choose a showroom staff member to operate the Point of Sale on their behalf. Sales will be deducted from their inventory.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                     <Select onValueChange={handleSelectStaff}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a staff member..." />
                        </SelectTrigger>
                        <SelectContent>
                            {allStaff.map(staff => (
                                <SelectItem key={staff.staff_id} value={staff.staff_id}>
                                    {staff.name} ({staff.role})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </DialogContent>
        </Dialog>


        {/* Checkout Method Dialog */}
        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select Payment Method</DialogTitle>
                    <DialogDescription>
                        Total Amount: <span className="font-bold text-foreground">₦{total.toFixed(2)}</span>
                    </DialogDescription>
                </DialogHeader>
                 <div className="flex flex-col gap-4 py-4">
                    <Button type="button" variant="outline" className="h-20 text-lg w-full" onClick={() => { setIsCheckoutOpen(false); setConfirmMethod('Cash'); setIsConfirmOpen(true); } }>
                        <Wallet className="mr-2 h-6 w-6" />
                        Pay with Cash
                    </Button>
                    <Button type="button" variant="outline" className="h-20 text-lg w-full" onClick={() => { setIsCheckoutOpen(false); setConfirmMethod('POS'); setIsConfirmOpen(true); } }>
                        <CreditCard className="mr-2 h-6 w-6" />
                        Pay with POS
                    </Button>
                    <Button className="h-20 text-lg w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handlePaystackPayment}>
                        <ArrowRightLeft className="mr-2 h-6 w-6"/>
                        Pay with Paystack
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        
        {/* Cash/POS Confirmation Dialog */}
        <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm {confirmMethod} Payment</AlertDialogTitle>
                    <AlertDialogDescription>
                        Have you received <strong>₦{total.toFixed(2)}</strong> via {confirmMethod}? This action will finalize the order and log it for necessary approvals.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmMethod(null)}>No, Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleOfflinePayment(confirmMethod!)}>Yes, I've received it</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Receipt Dialog */}
        <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
            <DialogContent className="sm:max-w-xs print:max-w-full print:border-none print:shadow-none">
                <DialogHeader>
                   <DialogTitle className="sr-only">Sale Receipt</DialogTitle>
                </DialogHeader>
                <div ref={receiptRef}>
                    {lastCompletedOrder && <Receipt order={lastCompletedOrder} storeAddress={storeAddress} />}
                </div>
                <DialogFooter className="flex-row justify-end gap-2 print:hidden">
                    <Button variant="outline" onClick={() => handlePrint(receiptRef.current)}><Printer className="mr-2 h-4 w-4"/> Print</Button>
                    <DialogClose asChild>
                      <Button onClick={() => setIsReceiptOpen(false)}>Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
     </>
  );
}

function POSPageWithSuspense() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-16 w-16 animate-spin" /></div>}>
            <POSPageContent />
        </Suspense>
    )
}

export default function POSPageWithTypes() {
  return <POSPageWithSuspense />;
}
