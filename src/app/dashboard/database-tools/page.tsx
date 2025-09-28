

"use client";

import { useState } from "react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
    seedUsersAndConfig,
    seedProductsAndIngredients,
    seedCustomersAndSuppliers,
    seedFinancialRecords,
    seedOperationalData,
    seedCommunicationData,
    seedFullData,
    clearMultipleCollections,
} from "@/app/seed/actions";
import { Loader2, DatabaseZap, Trash2, ArrowLeft } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import speakeasy from 'speakeasy';


const collectionsToClear = [
    "products", "staff", "recipes", "promotions", "suppliers", 
    "ingredients", "other_supplies", "customers", "orders", "transfers", 
    "production_batches", "waste_logs", "attendance", "sales", "debt", 
    "directCosts", "indirectCosts", "wages", "closingStocks", 
    "discount_records", "announcements", "reports", "cost_categories",
    "payment_confirmations", "supply_requests", "ingredient_stock_logs",
    "production_logs", "settings"
];


export default function DatabaseToolsPage() {
  const [isPending, startTransition] = useState(false);
  const [currentlySeeding, setCurrentlySeeding] = useState<string | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const { toast } = useToast();
  const [isVerified, setIsVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  const handleVerification = () => {
    // This is a placeholder for actual user verification
    // In a real app, you would verify the user's password and MFA status
    const isPasswordCorrect = password === 'password123';
    const isMfaCorrect = mfaCode ? speakeasy.totp.verify({ secret: 'DB_TOOLS_SECRET', encoding: 'base32', token: mfaCode }) : true; // Simplified for prototype

    if (isPasswordCorrect) {
        setIsVerified(true);
        toast({ title: "Access Granted", description: "Database tools unlocked." });
    } else {
        toast({ variant: "destructive", title: "Access Denied", description: "Incorrect password or MFA code." });
    }
  };

  const handleSeedAction = (actionName: string, actionFn: () => Promise<{ success: boolean; error?: string }>) => {
    setCurrentlySeeding(actionName);
    startTransition(true);
    actionFn().then(result => {
      if (result.success) {
        toast({
          title: "Success!",
          description: `${actionName} completed successfully.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || `An error occurred during ${actionName}.`,
        });
      }
      setCurrentlySeeding(null);
      startTransition(false);
    });
  };
  
  const handleClearMultiple = async () => {
    if (selectedCollections.length === 0) return;
    setCurrentlySeeding('clear_multiple');
    startTransition(true);

    const result = await clearMultipleCollections(selectedCollections);
    
    if (result.success) {
        toast({ title: "Success!", description: `Cleared collections: ${result.cleared?.join(', ')}`});
        if (result.errors && result.errors.length > 0) {
             toast({ variant: "destructive", title: "Some collections failed", description: `Failed to clear: ${result.errors.join(', ')}`});
        }
    } else {
         toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred."});
    }

    setSelectedCollections([]);
    setCurrentlySeeding(null);
    startTransition(false);
  };
  
  const handleToggleCollection = (collectionName: string) => {
    setSelectedCollections(prev => 
        prev.includes(collectionName)
            ? prev.filter(name => name !== collectionName)
            : [...prev, collectionName]
    );
  };
  
  if (!isVerified) {
    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Verification Required</CardTitle>
                <CardDescription>Enter your credentials to access the database tools.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="db-password">Password</Label>
                    <Input 
                        id="db-password" 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerification()}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="mfa-code">MFA Code (if enabled)</Label>
                    <Input 
                        id="mfa-code" 
                        type="text"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerification()}
                        placeholder="123456"
                    />
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="outline" asChild>
                    <Link href="/">Cancel</Link>
                </Button>
                <Button onClick={handleVerification}>Verify</Button>
            </CardFooter>
        </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-headline">Database Tools</h1>
            <Button variant="outline" asChild>
                <Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Login</Link>
            </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Seed Data</CardTitle>
                        <CardDescription>Seed the database with demo data incrementally.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <Button 
                            variant="secondary"
                            onClick={() => handleSeedAction("Full Database", seedFullData)}
                            disabled={isPending}
                            className="w-full"
                        >
                            {currentlySeeding === "Full Database" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4"/>}
                            Seed Full Demo Data
                        </Button>
                        <Separator className="my-2" />
                         <div className="grid grid-cols-2 gap-2">
                            <Button 
                                variant="outline" 
                                onClick={() => handleSeedAction("Users & Config", seedUsersAndConfig)}
                                disabled={isPending}
                                className="text-xs h-12"
                            >
                                {currentlySeeding === "Users & Config" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                1. Seed Users & Config
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => handleSeedAction("Products & Recipes", seedProductsAndIngredients)}
                                disabled={isPending}
                                className="text-xs h-12"
                            >
                                {currentlySeeding === "Products & Recipes" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                2. Seed Products & Recipes
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => handleSeedAction("Customers & Suppliers", seedCustomersAndSuppliers)}
                                disabled={isPending}
                                className="text-xs h-12"
                            >
                                {currentlySeeding === "Customers & Suppliers" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                3. Seed Customers & Suppliers
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => handleSeedAction("Financial Records", seedFinancialRecords)}
                                disabled={isPending}
                                className="text-xs h-12"
                            >
                                {currentlySeeding === "Financial Records" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                4. Seed Financial Records
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => handleSeedAction("Operational Data", seedOperationalData)}
                                disabled={isPending}
                                className="text-xs h-12"
                            >
                                {currentlySeeding === "Operational Data" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                5. Seed Operational Data
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => handleSeedAction("Communication Data", seedCommunicationData)}
                                disabled={isPending}
                                className="text-xs h-12"
                            >
                                {currentlySeeding === "Communication Data" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                6. Seed Communication Data
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {selectedCollections.length > 0 && (
                    <Card className="bg-destructive/10 border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive">Staged for Deletion</CardTitle>
                            <CardDescription className="text-destructive/80">
                                The following collections will be permanently cleared.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            {selectedCollections.map(name => (
                                <Badge key={name} variant="destructive">{name}</Badge>
                            ))}
                        </CardContent>
                        <CardFooter>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isPending}>
                                        {currentlySeeding === "clear_multiple" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Clear ({selectedCollections.length}) Selected Collections
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete all data from the selected collections: {selectedCollections.join(', ')}. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearMultiple} className="bg-destructive hover:bg-destructive/90">Yes, Clear Selected</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                )}
            </div>

            <Card className="md:col-span-1">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>Select collections to clear. Actions are irreversible.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                    <h4 className="font-semibold text-sm">Select Collections to Clear</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                       {collectionsToClear.map(name => (
                         <div key={name} className="flex items-center gap-2 p-2 border rounded-md">
                           <Checkbox 
                             id={`check-${name}`} 
                             checked={selectedCollections.includes(name)}
                             onCheckedChange={() => handleToggleCollection(name)}
                             disabled={isPending}
                           />
                           <label htmlFor={`check-${name}`} className="text-sm font-medium">{name}</label>
                         </div>
                       ))}
                    </div>
                 </CardContent>
            </Card>
        </div>
    </div>
  );
}

