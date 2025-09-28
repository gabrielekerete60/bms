
"use client";
import { useState, useEffect, useMemo } from "react";
import {
  FileDown,
  PlusCircle,
  Search,
  MoreHorizontal,
  Calendar as CalendarIcon,
  Loader2,
} from "lucide-react";
import Select, { StylesConfig } from "react-select";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select as ShadSelect,
  SelectContent as ShadSelectContent,
  SelectItem as ShadSelectItem,
  SelectTrigger as ShadSelectTrigger,
  SelectValue as ShadSelectValue,
} from "@/components/ui/select";
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Promotion = {
    id: string;
    name: string;
    description: string;
    type: string;
    value: number | null;
    code: string;
    startDate: string;
    endDate: string;
    status: "Active" | "Expired" | "Scheduled";
    applicableProducts?: { value: string, label: string }[];
    usageLimit: number;
    timesUsed: number;
};

type Product = {
  id: string;
  name: string;
}

const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
        case 'active':
            return 'default';
        case 'expired':
            return 'destructive';
        case 'scheduled':
            return 'secondary';
        default:
            return 'outline';
    }
}

function CreatePromotionDialog({ onSave, products, promotion, isOpen, onOpenChange }: { onSave: (promo: Omit<Promotion, 'id' | 'status'>) => void, products: Product[], promotion?: Promotion | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("percentage");
  const [value, setValue] = useState<number | null>(0);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [applicableProducts, setApplicableProducts] = useState<{ value: string, label: string }[]>([]);
  const [usageLimit, setUsageLimit] = useState<number | string>(100);

  useEffect(() => {
    if (isOpen) {
      if (promotion) {
        setName(promotion.name);
        setDescription(promotion.description);
        setCode(promotion.code);
        setType(promotion.type);
        setValue(promotion.value);
        setStartDate(promotion.startDate ? new Date(promotion.startDate) : undefined);
        setEndDate(promotion.endDate ? new Date(promotion.endDate) : undefined);
        setApplicableProducts(promotion.applicableProducts || []);
        setUsageLimit(promotion.usageLimit || 0);
      } else {
        setName("");
        setDescription("");
        setCode("");
        setType("percentage");
        setValue(0);
        setStartDate(undefined);
        setEndDate(undefined);
        setApplicableProducts([]);
        setUsageLimit(100);
      }
    }
  }, [isOpen, promotion]);


  const handleSubmit = () => {
    if (!name || !code || !startDate || !endDate) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields.' });
        return;
    }
    const promoData = {
      name,
      description,
      code,
      type,
      value,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      applicableProducts,
      usageLimit: Number(usageLimit),
      timesUsed: promotion?.timesUsed || 0
    }
    onSave(promoData);
    onOpenChange(false);
  }

  const productOptions = products.map(p => ({ value: p.id, label: p.name }));
  
  const customSelectStyles: StylesConfig = {
    control: (provided) => ({
      ...provided,
      backgroundColor: 'hsl(var(--input))',
      borderColor: 'hsl(var(--border))',
      color: 'hsl(var(--foreground))',
      boxShadow: 'none',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: 'hsl(var(--primary) / 0.8)',
      color: 'hsl(var(--primary-foreground))',
    }),
     multiValueLabel: (provided) => ({
        ...provided,
        color: 'hsl(var(--primary-foreground))',
    }),
    multiValueRemove: (provided) => ({
        ...provided,
        color: 'hsl(var(--primary-foreground))',
        ':hover': {
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
        },
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'hsl(var(--popover))',
      color: 'hsl(var(--popover-foreground))',
      border: '1px solid hsl(var(--border))',
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'transparent',
        color: state.isFocused ? 'hsl(var(--accent-foreground))' : 'hsl(var(--popover-foreground))',
        cursor: 'pointer'
    }),
    input: (provided) => ({
        ...provided,
        color: 'hsl(var(--foreground))'
    }),
    placeholder: (provided) => ({
        ...provided,
        color: 'hsl(var(--muted-foreground))'
    }),
    singleValue: (provided) => ({
        ...provided,
        color: 'hsl(var(--foreground))'
    })
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{promotion ? "Edit Promotion" : "Add New Promotion"}</DialogTitle>
          <DialogDescription>
            Fill in the details for the customer promotion.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
          <div className="grid gap-2">
            <Label htmlFor="promotion-name">Promotion Name</Label>
            <Input id="promotion-name" placeholder="e.g. Summer Sale" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Describe the promotion" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="promo-code">Promo Code</Label>
              <Input id="promo-code" placeholder="e.g. SUMMER25" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
               <ShadSelect value={type} onValueChange={setType}>
                <ShadSelectTrigger>
                  <ShadSelectValue placeholder="Select type" />
                </ShadSelectTrigger>
                <ShadSelectContent>
                  <ShadSelectItem value="percentage">Percentage Discount</ShadSelectItem>
                  <ShadSelectItem value="fixed_amount">Fixed Amount Discount</ShadSelectItem>
                  <ShadSelectItem value="free_item">Free Item</ShadSelectItem>
                </ShadSelectContent>
              </ShadSelect>
            </div>
          </div>
           <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="value">Value</Label>
              <Input id="value" type="number" placeholder="0" value={value ?? ""} onChange={(e) => setValue(e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="usage-limit">Usage Limit</Label>
              <Input id="usage-limit" type="number" placeholder="100" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />
            </div>
          </div>
           <div className="grid gap-2">
                <Label htmlFor="applicable-products">Applicable Products</Label>
                 <Select
                    isMulti
                    options={productOptions}
                    value={applicableProducts}
                    onChange={(selected) => setApplicableProducts(selected as any)}
                    placeholder="Select products... (leave empty for all)"
                    styles={customSelectStyles}
                />
            </div>
           <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
               <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
             <div className="grid gap-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{promotion ? "Save Changes" : "Create Promotion"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ExportDialog({ children, onExport }: { children: React.ReactNode, onExport: (options: { dateRange?: DateRange }) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Promotions</DialogTitle>
          <DialogDescription>
            Select a date range to export promotions to a CSV file. Promotions active within this range will be exported.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                    "w-full justify-start text-left font-normal",
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
                    <span>Filter by date range</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                />
                </PopoverContent>
            </Popover>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={() => { onExport({ dateRange: date }); setIsOpen(false); }}>Export to CSV</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


export default function PromotionsPage() {
  const { toast } = useToast();
  const [promotionsData, setPromotionsData] = useState<Promotion[]>([]);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);


  const fetchPromotions = async () => {
      setIsLoading(true);
      try {
        const promotionsCollection = collection(db, "promotions");
        const promotionSnapshot = await getDocs(promotionsCollection);
        const promotionsList = promotionSnapshot.docs.map(doc => {
            const data = doc.data();
            const now = new Date();
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            let status: "Active" | "Expired" | "Scheduled" = "Active";
            if (end < now) status = "Expired";
            else if (start > now) status = "Scheduled";
            return { id: doc.id, ...data, status } as Promotion
        });
        setPromotionsData(promotionsList);

        const productsCollection = collection(db, "products");
        const productSnapshot = await getDocs(productsCollection);
        const productsList = productSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
        })) as Product[];
        setProductsData(productsList);

      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch data from the database.",
        });
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchPromotions();
  }, []);
  
  const handleSavePromotion = async (promoData: Omit<Promotion, 'id' | 'status'>) => {
    try {
        const dataToSave = { ...promoData };
        if (editingPromotion) {
            await updateDoc(doc(db, "promotions", editingPromotion.id), dataToSave);
            toast({ title: "Success", description: "Promotion updated." });
        } else {
            await addDoc(collection(db, "promotions"), dataToSave);
            toast({ title: "Success", description: "Promotion created." });
        }
        fetchPromotions();
        setEditingPromotion(null);
    } catch (error) {
        console.error("Error saving promotion:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to save promotion." });
    }
  };

  const handleDeletePromotion = async () => {
    if (!promotionToDelete) return;
    try {
        await deleteDoc(doc(db, "promotions", promotionToDelete.id));
        toast({ title: "Success", description: "Promotion deleted." });
        fetchPromotions();
    } catch (error) {
        console.error("Error deleting promotion:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to delete promotion." });
    } finally {
        setIsDeleteDialogOpen(false);
        setPromotionToDelete(null);
    }
  };
  
  const openAddDialog = () => {
    setEditingPromotion(null);
    setIsPromoDialogOpen(true);
  };
  
  const openEditDialog = (promo: Promotion) => {
    setEditingPromotion(promo);
    setIsPromoDialogOpen(true);
  };

  const openDeleteDialog = (promo: Promotion) => {
    setPromotionToDelete(promo);
    setIsDeleteDialogOpen(true);
  };

  const handleExport = (options: { dateRange?: DateRange }) => {
    let promosToExport = promotionsData;

    if (options.dateRange?.from) {
        promosToExport = promosToExport.filter(promo => {
            const startDate = new Date(promo.startDate);
            const endDate = new Date(promo.endDate);
            return endDate >= options.dateRange!.from! && (!options.dateRange!.to || startDate <= options.dateRange!.to!);
        });
    }

    const headers = ["ID", "Name", "Code", "Type", "Value", "Start Date", "End Date", "Status", "Times Used", "Usage Limit"];
    const rows = promosToExport.map(p => 
        [p.id, p.name, p.code, p.type, p.value || "N/A", new Date(p.startDate).toLocaleDateString(), new Date(p.endDate).toLocaleDateString(), p.status, p.timesUsed, p.usageLimit].join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `promotions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Success", description: `${promosToExport.length} promotions exported.` });
  };


  const filteredPromotions = useMemo(() => {
    return promotionsData.filter(promo => {
        const promoStartDate = new Date(promo.startDate);
        const promoEndDate = new Date(promo.endDate);
        promoEndDate.setHours(23, 59, 59, 999);

        const dateMatch = !date?.from || (promoEndDate >= date.from && (!date.to || promoStartDate <= date.to));
        const searchMatch = !searchTerm || promo.name.toLowerCase().includes(searchTerm.toLowerCase()) || promo.code.toLowerCase().includes(searchTerm.toLowerCase());
        const statusMatch = statusFilter.length === 0 || statusFilter.includes(promo.status);
        return dateMatch && searchMatch && statusMatch;
    });
  }, [promotionsData, date, searchTerm, statusFilter]);
  
  const handleStatusFilterChange = (status: string, checked: boolean) => {
    setStatusFilter(prev => {
        if (checked) {
            return [...prev, status];
        } else {
            return prev.filter(s => s !== status);
        }
    });
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox aria-label="Select all" />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {filteredPromotions.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                        No promotions found for this filter.
                    </TableCell>
                </TableRow>
            ) : (
                filteredPromotions.map((promo) => (
                    <TableRow key={promo.id}>
                    <TableCell>
                            <Checkbox aria-label={`Select promotion ${promo.name}`} />
                        </TableCell>
                    <TableCell className="font-medium">{promo.name}</TableCell>
                    <TableCell>
                        <Badge variant="outline">{promo.code}</Badge>
                    </TableCell>
                    <TableCell>
                        {promo.timesUsed} / {promo.usageLimit === 0 ? "∞" : promo.usageLimit}
                    </TableCell>
                    <TableCell>{new Date(promo.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(promo.endDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                        <Badge variant={getStatusVariant(promo.status)}>
                            {promo.status}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                aria-haspopup="true"
                                size="icon"
                                variant="ghost"
                                >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => openEditDialog(promo)}>Edit</DropdownMenuItem>
                                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onSelect={() => openDeleteDialog(promo)}>
                                Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    </TableRow>
                ))
            )}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-headline">Promotions</h1>
         <Button onClick={openAddDialog}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Promotion
        </Button>
      </div>

      <CreatePromotionDialog 
        onSave={handleSavePromotion} 
        products={productsData} 
        promotion={editingPromotion}
        isOpen={isPromoDialogOpen}
        onOpenChange={setIsPromoDialogOpen}
      />

      <Tabs defaultValue="promotions">
        <TabsList>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="incentives">Staff Incentives</TabsTrigger>
        </TabsList>
        <TabsContent value="promotions">
          <Card>
            <CardHeader>
              <CardTitle>Manage Promotions</CardTitle>
              <CardDescription>
                View, create, and manage your promotional offers.
              </CardDescription>
              <div className="flex items-center justify-between gap-4 pt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input placeholder="Search by name or code..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                    <Popover>
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
                            <span>Filter by date range</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                        />
                        </PopoverContent>
                    </Popover>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="ml-auto">
                              Status
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem checked={statusFilter.includes('Active')} onCheckedChange={(c) => handleStatusFilterChange('Active', c as boolean)}>Active</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={statusFilter.includes('Scheduled')} onCheckedChange={(c) => handleStatusFilterChange('Scheduled', c as boolean)}>Scheduled</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={statusFilter.includes('Expired')} onCheckedChange={(c) => handleStatusFilterChange('Expired', c as boolean)}>Expired</DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ExportDialog onExport={handleExport}>
                        <Button variant="outline">
                            <FileDown className="mr-2" /> Export
                        </Button>
                    </ExportDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderContent()}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="incentives">
            <Card>
                <CardHeader>
                    <CardTitle>Staff Incentives</CardTitle>
                    <CardDescription>This feature is coming soon.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
                    <p>Incentive logs will be displayed here.</p>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the promotion "{promotionToDelete?.name}". This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletePromotion}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
