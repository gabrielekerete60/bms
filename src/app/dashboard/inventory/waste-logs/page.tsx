

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getWasteLogs, getWasteLogsForStaff, WasteLog } from "@/app/actions";
import { collection, getDocs, where, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, startOfDay } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Product = {
    id: string;
    name: string;
    category: string;
}

type User = {
    staff_id: string;
    role: string;
}

function WasteLogDetailsDialog({ log, isOpen, onOpenChange }: { log: WasteLog | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    if (!log) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Waste Log Details</DialogTitle>
                    <DialogDescription>Details for waste log from {format(new Date(log.date), 'PPP')}.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2 text-sm">
                    <p><strong>Product:</strong> {log.productName}</p>
                    <p><strong>Category:</strong> {log.productCategory}</p>
                    <p><strong>Quantity:</strong> {log.quantity}</p>
                    <p><strong>Reason:</strong> {log.reason}</p>
                    <p><strong>Reported by:</strong> {log.staffName}</p>
                    {log.notes && <p><strong>Notes:</strong> {log.notes}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function WasteLogsPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingLog, setViewingLog] = useState<WasteLog | null>(null);

    const [categoryFilter, setCategoryFilter] = useState("all");
    const [reasonFilter, setReasonFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const userStr = localStorage.getItem('loggedInUser');
        if (userStr) {
            setUser(JSON.parse(userStr));
        }
    }, []);

    const fetchPageData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);

        const isAdminOrStorekeeper = ['Manager', 'Developer', 'Supervisor', 'Storekeeper', 'Accountant'].includes(user.role);

        try {
            const logsData = isAdminOrStorekeeper ? await getWasteLogs() : await getWasteLogsForStaff(user.staff_id);
            setWasteLogs(logsData);

            if (products.length === 0) {
                 const productsSnapshot = await getDocs(collection(db, "products"));
                 setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load waste log data." });
        } finally {
            setIsLoading(false);
        }
    }, [toast, user, products.length]);

    useEffect(() => {
        if (user) {
            fetchPageData();
        }
    }, [user, fetchPageData]);
    
    const productCategories = useMemo(() => ["all", ...new Set(products.map(p => p.category))], [products]);
    const wasteReasons = useMemo(() => ["all", "Spoiled", "Damaged", "Burnt", "Error", "Other"], []);

    const filteredLogs = useMemo(() => {
        let logs = wasteLogs;

        if (user?.role === 'Showroom Staff') {
            const today = startOfDay(new Date());
            logs = logs.filter(log => new Date(log.date) >= today);
        }

        return logs.filter(log => {
            const categoryMatch = categoryFilter === 'all' || log.productCategory === categoryFilter;
            const reasonMatch = reasonFilter === 'all' || log.reason === reasonFilter;
            const searchMatch = !searchTerm || log.productName.toLowerCase().includes(searchTerm.toLowerCase());
            return categoryMatch && reasonMatch && searchMatch;
        });
    }, [wasteLogs, categoryFilter, reasonFilter, searchTerm, user?.role]);

    if (!user) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    const isAdminOrStorekeeper = ['Manager', 'Developer', 'Supervisor', 'Storekeeper', 'Accountant'].includes(user.role);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold font-headline">Waste Logs</h1>
            <WasteLogDetailsDialog log={viewingLog} isOpen={!!viewingLog} onOpenChange={() => setViewingLog(null)} />
            <Card>
                <CardHeader>
                    <CardTitle>Manage Waste Logs</CardTitle>
                    <CardDescription>
                        {isAdminOrStorekeeper ? "Review all reported waste and damage across the business." : "A log of all items you have reported as waste."}
                    </CardDescription>
                     <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4">
                        <div className="relative flex-1 w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input placeholder="Search by product name..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                             <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Filter by category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {productCategories.map(cat => (
                                        <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={reasonFilter} onValueChange={setReasonFilter}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Filter by reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    {wasteReasons.map(reason => (
                                        <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="md:hidden space-y-4">
                        {isLoading ? (
                             <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin"/></div>
                        ) : filteredLogs.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">No waste logs found.</p>
                        ) : (
                            filteredLogs.map(log => (
                                <Card key={log.id} className="p-4" onClick={() => setViewingLog(log)}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{log.productName}</p>
                                            <p className="text-sm text-muted-foreground">{log.reason}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(log.date), 'PPP')}</p>
                                        </div>
                                        <p className="font-bold">{log.quantity}</p>
                                    </div>
                                    {isAdminOrStorekeeper && <p className="text-sm mt-2 pt-2 border-t">Reported by: {log.staffName}</p>}
                                </Card>
                            ))
                        )}
                    </div>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    {isAdminOrStorekeeper && <TableHead>Staff</TableHead>}
                                    <TableHead>Product</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={isAdminOrStorekeeper ? 6 : 5} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                                ) : filteredLogs.length === 0 ? (
                                    <TableRow><TableCell colSpan={isAdminOrStorekeeper ? 6 : 5} className="h-24 text-center">No waste logs found for this filter.</TableCell></TableRow>
                                ) : (
                                    filteredLogs.map(log => (
                                        <TableRow key={log.id} onClick={() => setViewingLog(log)} className="cursor-pointer hover:bg-muted/50">
                                            <TableCell>{format(new Date(log.date), 'PPP')}</TableCell>
                                            {isAdminOrStorekeeper && <TableCell>{log.staffName}</TableCell>}
                                            <TableCell>{log.productName}</TableCell>
                                            <TableCell>{log.quantity}</TableCell>
                                            <TableCell>{log.reason}</TableCell>
                                            <TableCell>{log.notes || 'N/A'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                    <div className="text-xs text-muted-foreground">
                        Showing <strong>{filteredLogs.length}</strong> of <strong>{wasteLogs.length}</strong> logs.
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
