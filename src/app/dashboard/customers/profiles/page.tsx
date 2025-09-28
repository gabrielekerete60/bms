
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  joinedDate: string;
  totalSpent: number;
};

function CustomerDialog({
  isOpen,
  onOpenChange,
  onSave,
  customer
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Customer, 'id' | 'joinedDate' | 'totalSpent'>) => void;
  customer: Partial<Customer> | null;
}) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");

    useEffect(() => {
        if (customer) {
            setName(customer.name || "");
            setPhone(customer.phone || "");
            setEmail(customer.email || "");
            setAddress(customer.address || "");
        } else {
            setName("");
            setPhone("");
            setEmail("");
            setAddress("");
        }
    }, [customer]);

    const handleSubmit = () => {
        if (!name || !phone) {
            toast({ variant: 'destructive', title: 'Error', description: 'Customer name and phone number are required.' });
            return;
        }
        onSave({ name, phone, email, address });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{customer?.id ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                    <DialogDescription>
                        {customer?.id ? 'Update the details of this customer.' : 'Fill in the details for the new customer.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
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
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>{customer?.id ? 'Save Changes' : 'Create Customer'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function CustomerProfilesPage() {
    const { toast } = useToast();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const customersCollection = collection(db, "customers");
            const snapshot = await getDocs(customersCollection);
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
            setCustomers(list);
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch customers." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleSaveCustomer = async (customerData: Omit<Customer, 'id' | 'joinedDate' | 'totalSpent'>) => {
        try {
            if (editingCustomer && editingCustomer.id) {
                const ref = doc(db, "customers", editingCustomer.id);
                await updateDoc(ref, customerData);
                toast({ title: "Success", description: "Customer updated successfully." });
            } else {
                const dataToSave = {
                    ...customerData,
                    joinedDate: new Date().toISOString(),
                    totalSpent: 0,
                };
                await addDoc(collection(db, "customers"), dataToSave);
                toast({ title: "Success", description: "Customer created successfully." });
            }
            fetchCustomers();
        } catch (error) {
            console.error("Error saving customer:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save customer." });
        }
    };

    const handleDeleteCustomer = async () => {
        if (!customerToDelete) return;
        try {
            await deleteDoc(doc(db, "customers", customerToDelete.id));
            toast({ title: "Success", description: "Customer deleted successfully." });
            fetchCustomers();
        } catch (error) {
            console.error("Error deleting customer:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete customer." });
        } finally {
            setCustomerToDelete(null);
        }
    };
    
    const openAddDialog = () => {
        setEditingCustomer({});
        setIsDialogOpen(true);
    };

    const openEditDialog = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsDialogOpen(true);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold font-headline">Customer Profiles</h1>
                <Button onClick={openAddDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Customer
                </Button>
            </div>

            <CustomerDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleSaveCustomer}
                customer={editingCustomer}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Manage Customers</CardTitle>
                    <CardDescription>
                        A list of all customers in your database.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>
                        ) : customers.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">No customers found.</p>
                        ) : (
                            customers.map(customer => (
                                <Card key={customer.id} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{customer.name}</p>
                                            <p className="text-sm text-muted-foreground">{customer.phone}</p>
                                            <p className="text-xs text-muted-foreground">Joined: {new Date(customer.joinedDate).toLocaleDateString()}</p>
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
                                                <DropdownMenuItem onSelect={() => openEditDialog(customer)}>Edit</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onSelect={() => setCustomerToDelete(customer)}>Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="mt-2 pt-2 border-t text-sm">
                                        <span>Total Spent:</span>
                                        <span className="font-bold float-right">₦{customer.totalSpent.toFixed(2)}</span>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Joined Date</TableHead>
                                    <TableHead>Total Spent</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                        </TableCell>
                                    </TableRow>
                                ) : customers.length > 0 ? (
                                    customers.map(customer => (
                                        <TableRow key={customer.id}>
                                            <TableCell className="font-medium">{customer.name}</TableCell>
                                            <TableCell>{customer.phone}</TableCell>
                                            <TableCell>{new Date(customer.joinedDate).toLocaleDateString()}</TableCell>
                                            <TableCell>₦{customer.totalSpent.toFixed(2)}</TableCell>
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
                                                        <DropdownMenuItem onSelect={() => openEditDialog(customer)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive" onSelect={() => setCustomerToDelete(customer)}>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            Showing 0 of 0 customers.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 <CardFooter>
                    <div className="text-xs text-muted-foreground">
                        Showing <strong>{customers.length}</strong> customers.
                    </div>
                </CardFooter>
            </Card>

            <AlertDialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the customer "{customerToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteCustomer}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
