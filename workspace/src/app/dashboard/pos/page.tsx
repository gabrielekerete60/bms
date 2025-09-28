
"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Plus, Minus, X, Search, Trash2, Hand, CreditCard, Printer, User, Building, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { collection, getDocs, doc, runTransaction, increment, getDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePaystackPayment } from "react-paystack";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image: string;
  'data-ai-hint': string;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type CompletedOrder = {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  date: string;
  paymentMethod: 'Card' | 'Cash';
  customerName?: string;
  status: 'Completed' | 'Pending' | 'Cancelled';
}

type User = {
  name: string;
  role: string;
  staff_id: string;
};

type SelectableStaff = {
    staff_id: string;
    name: string;
    role: string;
};

export default function POSPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldOrders, setHeldOrders] = useLocalStorage<CartItem[][]>('heldOrders', []);
  const [activeTab, setActiveTab] = useState('All');
  const [customerType, setCustomerType] = useState<'walk-in' | 'registered'>('walk-in');
  const [customerName, setCustomerName] = useState('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<CompletedOrder | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCashConfirmOpen, setIsCashConfirmOpen] = useState(false);

  // New state for manager's POS session
  const [allStaff, setAllStaff] = useState<SelectableStaff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffSelectionOpen, setIsStaffSelectionOpen] = useState(false);

  const fetchProductsForStaff = async (staffId: string) => {
    setIsLoadingProducts(true);
    const personalStockQuery = collection(db, 'staff', staffId, 'personal_stock');
    const stockSnapshot = await getDocs(personalStockQuery);
    
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
            } as Product;
        }
        return null;
    }).filter((p): p is Product => p !== null && p.stock > 0);

    setProducts(productsList);
    setIsLoadingProducts(false);
  }

  useEffect(() => {
    const initializePos = async () => {
      const storedUser = localStorage.getItem('loggedInUser');
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);

        const adminRoles = ['Manager', 'Developer'];
        if (adminRoles.includes(parsedUser.role)) {
          // Manager/Dev: Fetch all staff to choose from
          const staffQuery = query(collection(db, "staff"), where("role", "in", ["Showroom Staff", "Delivery Staff"]));
          const staffSnapshot = await getDocs(staffQuery);
          setAllStaff(staffSnapshot.docs.map(d => ({ staff_id: d.id, ...d.data() } as SelectableStaff)));
          setIsStaffSelectionOpen(true);
        } else {
          // Regular staff: Load their own inventory
          setSelectedStaffId(parsedUser.staff_id);
          fetchProductsForStaff(parsedUser.staff_id);
        }
      }
    };
    initializePos();
  }, [toast]);


  const categories = ['All', ...new Set(products.map(p => p.category))];

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + item.price * item.quantity, 0), [cart]);
  const tax = useMemo(() => subtotal * 0.075, [subtotal]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);
  
  const filteredProducts = useMemo(() => {
    if (activeTab === 'All') return products;
    return products.filter(p => p.category === activeTab);
  }, [activeTab, products]);


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
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
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
    setCart([]);
    setCustomerName('');
    toast({
        title: "Cart Cleared",
        description: "All items have been removed from the cart.",
    });
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    setHeldOrders(prev => [...prev, cart]);
    setCart([]);
    setCustomerName('');
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

  const completeOrder = async (paymentMethod: 'Card' | 'Cash') => {
    if (!user || !selectedStaffId) {
        toast({ variant: "destructive", title: "Error", description: "User or operating staff not identified. Cannot complete order." });
        return null;
    }

    const newOrderData = {
      items: cart,
      subtotal,
      tax,
      total,
      date: new Date().toISOString(),
      paymentMethod,
      customerName: customerName || 'Walk-in',
      status: 'Completed' as const,
      staff_id: selectedStaffId,
      staff_name: allStaff.find(s => s.staff_id === selectedStaffId)?.name || user.name
    };
  
    try {
      const orderRef = doc(collection(db, "orders"));
      await runTransaction(db, async (transaction) => {
          for (const item of cart) {
              const personalStockRef = doc(db, 'staff', selectedStaffId, 'personal_stock', item.id);
              const personalStockDoc = await transaction.get(personalStockRef);
              if (!personalStockDoc.exists() || personalStockDoc.data().stock < item.quantity) {
                  throw new Error(`Not enough stock for ${item.name}.`);
              }
              transaction.update(personalStockRef, { stock: increment(-item.quantity) });
          }
          
          transaction.set(orderRef, newOrderData);
      });
      
      const newOrder: CompletedOrder = {
        id: orderRef.id,
        ...newOrderData,
      };
      
      setLastCompletedOrder(newOrder);
      setCart([]);
      setCustomerName('');

      await fetchProductsForStaff(selectedStaffId);
      
      return newOrder;
    } catch (error) {
      console.error("Error saving order:", error);
      const errorMessage = error instanceof Error ? error.message : "There was a problem saving the order to the database.";
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: errorMessage,
      });
      return null;
    }
  }

  const handleCashPayment = async () => {
    setIsCashConfirmOpen(false);
    const completed = await completeOrder('Cash');
    if (completed) {
        toast({ title: 'Order Successful', description: 'The order has been completed.' });
        setIsReceiptOpen(true);
    }
  }

  const paystackConfig = {
      reference: new Date().getTime().toString(),
      email: "customer@example.com",
      amount: Math.round(total * 100), // Amount in kobo
      publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const onPaystackSuccess = async () => {
    setIsCheckoutOpen(false);
    const completed = await completeOrder('Card');
    if (completed) {
      setIsReceiptOpen(true);
      toast({
        title: "Payment Successful",
        description: "The order has been completed.",
      });
    }
  };

  const onPaystackClose = () => {
    toast({
      variant: "destructive",
      title: "Payment Cancelled",
      description: "The payment process was cancelled.",
    });
  };
  
  const handlePrintReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const receiptContent = document.getElementById('receipt-content');
        if (receiptContent) {
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
                        </style>
                    </head>
                    <body>
                        <div class="receipt-container">
                            ${receiptContent.innerHTML}
                        </div>
                    </body>
                </html>
            `;
            printWindow.document.write(printableContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }
    }
  }

  const handleSelectStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    fetchProductsForStaff(staffId);
    setIsStaffSelectionOpen(false);
  }

  const selectedStaffName = allStaff.find(s => s.staff_id === selectedStaffId)?.name || user?.name;


  return (
     <>
     <div className="grid grid-cols-1 xl:grid-cols-[1fr_450px] gap-6 h-[calc(100vh_-_8rem)] print:hidden">
      {/* Products Section */}
      <Card className="flex flex-col">
        <CardContent className="p-4 flex flex-col gap-4 flex-grow">
          <header className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold font-headline">Point of Sale</h1>
                {selectedStaffId && <p className="text-sm text-muted-foreground">Operating as: <span className="font-semibold text-primary">{selectedStaffName}</span></p>}
              </div>
               <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search products..." className="pl-10 w-64" />
                </div>
          </header>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
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

              <TabsContent value={activeTab} className="mt-4 flex-grow">
                  <ScrollArea className="h-[calc(100vh_-_22rem)]">
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
                                <p>{selectedStaffId ? "No products in this staff's inventory." : "Select a staff member to begin."}</p>
                            </div>
                        )
                      )}
                  </ScrollArea>
              </TabsContent>
               <TabsContent value="held-orders" className="mt-4">
                  <ScrollArea className="h-[calc(100vh_-_22rem)]">
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

      {/* Order Summary Section */}
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
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">₦{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax (7.5%)</span>
                    <span className="font-medium">₦{tax.toFixed(2)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>₦{total.toFixed(2)}</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
                <Button variant="outline" onClick={holdOrder} disabled={cart.length === 0 || !selectedStaffId}>
                    <Hand /> Hold
                </Button>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={cart.length === 0 || !selectedStaffId}>
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
             <Button size="lg" className="w-full font-bold text-lg" disabled={cart.length === 0 || !selectedStaffId} onClick={() => setIsCheckoutOpen(true)}>
                Checkout
             </Button>
        </CardFooter>
      </Card>
      </div>

       {/* ---- DIALOGS ---- */}

        {/* Manager Staff Selection Dialog */}
        <Dialog open={isStaffSelectionOpen} onOpenChange={setIsStaffSelectionOpen}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Select Staff POS</DialogTitle>
                    <DialogDescription>
                        Choose a staff member to operate the Point of Sale on their behalf. Sales will be deducted from their inventory.
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
                <div className="grid grid-cols-2 gap-4 py-4">
                     <Button variant="outline" className="h-24 text-lg" onClick={() => { setIsCheckoutOpen(false); setIsCashConfirmOpen(true); }}>
                        <Wallet className="mr-2 h-6 w-6" />
                        Pay with Cash
                    </Button>
                    <Button className="h-24 text-lg" onClick={() => initializePayment({onSuccess: onPaystackSuccess, onClose: onPaystackClose})}>
                        <CreditCard className="mr-2 h-6 w-6" />
                        Pay with Paystack
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        
        {/* Cash Confirmation Dialog */}
        <AlertDialog open={isCashConfirmOpen} onOpenChange={setIsCashConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Cash Payment</AlertDialogTitle>
                    <AlertDialogDescription>
                        Have you received <strong>₦{total.toFixed(2)}</strong> in cash from the customer?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>No, Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCashPayment}>Yes, I've received it</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Receipt Dialog */}
        {lastCompletedOrder && (
            <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
                <DialogContent className="sm:max-w-md print:max-w-full print:border-none print:shadow-none">
                     <div id="receipt-content">
                        <DialogHeader>
                            <DialogTitle className="font-headline text-2xl text-center">BMS</DialogTitle>
                            <DialogDescription className="text-center">
                                Sale Receipt
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="text-sm text-muted-foreground">
                                <p><strong>Order ID:</strong> {lastCompletedOrder.id}</p>
                                <p><strong>Date:</strong> {new Date(lastCompletedOrder.date).toLocaleString()}</p>
                                <p><strong>Payment Method:</strong> {lastCompletedOrder.paymentMethod}</p>
                                <p><strong>Customer:</strong> {lastCompletedOrder.customerName || 'Walk-in'}</p>
                            </div>
                            <Separator />
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lastCompletedOrder.items.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                        <TableCell className="text-right">₦{(item.price * item.quantity).toFixed(2)}</TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <Separator />
                            <div className="w-full space-y-1 text-sm pr-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-medium">₦{lastCompletedOrder.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tax (7.5%)</span>
                                    <span className="font-medium">₦{lastCompletedOrder.tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-base mt-1">
                                    <span>Total</span>
                                    <span>₦{lastCompletedOrder.total.toFixed(2)}</span>
                                </div>
                            </div>
                            <Separator />
                            <p className="text-center text-xs text-muted-foreground">Thank you for your patronage!</p>
                        </div>
                    </div>
                    <DialogFooter className="flex justify-end gap-2 print:hidden">
                        <Button variant="outline" onClick={handlePrintReceipt}><Printer className="mr-2 h-4 w-4"/> Print</Button>
                        <Button onClick={() => setIsReceiptOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
     </>
  );
}

    