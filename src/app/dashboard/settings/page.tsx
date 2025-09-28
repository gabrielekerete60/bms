
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldCheck, Copy, KeyRound, Eye, EyeOff, Store, Settings2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { disableMfa, verifyMfaSetup, handleChangePassword, handleUpdateTheme, updateAppSettings } from '@/app/actions';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocalStorage } from '@/hooks/use-local-storage';


type User = {
    name: string;
    role: string;
    staff_id: string;
    email: string;
    theme?: string;
};

type MfaSetup = {
    secret: string;
    qrCode: string;
}

function ChangePasswordForm({ user }: { user: User }) {
    const { toast } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast({ variant: 'destructive', title: 'Error', description: 'New passwords do not match.' });
            return;
        }
        if (newPassword.length < 6) {
            toast({ variant: 'destructive', title: 'Error', description: 'New password must be at least 6 characters long.' });
            return;
        }

        setIsSubmitting(true);
        const result = await handleChangePassword(user.staff_id, currentPassword, newPassword);
        if (result.success) {
            toast({ title: 'Success!', description: 'Your password has been changed.' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your login password here.</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <div className="relative">
                            <Input id="current-password" type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowCurrent(!showCurrent)}>
                                {showCurrent ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                            </Button>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="relative">
                            <Input id="new-password" type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                             <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowNew(!showNew)}>
                                {showNew ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                            </Button>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <div className="relative">
                            <Input id="confirm-password" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowConfirm(!showConfirm)}>
                                {showConfirm ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                            </Button>
                        </div>
                    </div>
                </form>
            </CardContent>
            <CardFooter>
                 <Button form="change-password-form" type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Change Password
                </Button>
            </CardFooter>
        </Card>
    )
}

function ThemeSettings({ user }: { user: User }) {
    const { toast } = useToast();
    const [localUser, setLocalUser] = useLocalStorage<User | null>('loggedInUser', null);
    const [selectedTheme, setSelectedTheme] = useState(user.theme || 'default');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setSelectedTheme(user.theme || 'default');
    }, [user.theme]);

    const handleSaveTheme = async () => {
        setIsSaving(true);
        const result = await handleUpdateTheme(user.staff_id, selectedTheme);
        if (result.success) {
            setLocalUser({ ...user, theme: selectedTheme });
            toast({ title: 'Theme saved!', description: 'Applying new theme...' });
            // Force a reload to ensure all components get the new theme from CSS variables
            window.location.reload();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save your theme preference.' });
            setIsSaving(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Theme Preference</CardTitle>
                <CardDescription>Choose a visual theme for your dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
                <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                    <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Select a theme" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="default">Default Dark</SelectItem>
                        <SelectItem value="midnight">Midnight</SelectItem>
                        <SelectItem value="forest">Forest</SelectItem>
                        <SelectItem value="slate">Slate</SelectItem>
                        <SelectItem value="crimson">Crimson</SelectItem>
                        <SelectItem value="emerald">Emerald</SelectItem>
                        <SelectItem value="abyss">Abyss</SelectItem>
                        <SelectItem value="sunset">Sunset</SelectItem>
                        <Separator className="my-1" />
                        <SelectItem value="classic-light">Classic Light</SelectItem>
                        <SelectItem value="rose-gold">Rosé Gold (Light)</SelectItem>
                        <SelectItem value="solaris">Solaris (Light)</SelectItem>
                        <SelectItem value="oceanic">Oceanic (Light)</SelectItem>
                        <SelectItem value="lavender">Lavender (Light)</SelectItem>
                        <SelectItem value="vintage">Vintage (Light)</SelectItem>
                        <SelectItem value="sakura">Sakura (Light)</SelectItem>
                    </SelectContent>
                </Select>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSaveTheme} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Save Theme
                </Button>
            </CardFooter>
        </Card>
    )
}

function StoreCustomization({ currentSettings }: { currentSettings: any }) {
    const { toast } = useToast();
    const [storeAddress, setStoreAddress] = useState(currentSettings.storeAddress || '');
    const [staffIdLength, setStaffIdLength] = useState(currentSettings.staffIdLength || 6);
    const [autoClockOutTime, setAutoClockOutTime] = useState(currentSettings.autoClockOutTime || '21:00');
    const [clockInEnabledTime, setClockInEnabledTime] = useState(currentSettings.clockInEnabledTime || '06:00');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const timeOptions = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0');
        return [`${hour}:00`, `${hour}:30`];
    }).flat();

    const handleSave = async () => {
        setIsSubmitting(true);
        const result = await updateAppSettings({
            storeAddress,
            staffIdLength: Number(staffIdLength),
            autoClockOutTime,
            clockInEnabledTime,
        });
        if (result.success) {
            toast({ title: 'Success!', description: 'Application settings have been updated.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Store &amp; Time Settings</CardTitle>
                <CardDescription>Manage global settings for your store, staff, and attendance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4 p-4 border rounded-md">
                     <h4 className="font-semibold text-lg flex items-center gap-2"><Store className="h-5 w-5"/> Store Settings</h4>
                     <Separator/>
                    <div className="space-y-2">
                        <Label htmlFor="store-address">Store Address</Label>
                        <Input id="store-address" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} placeholder="e.g., 123 Bakery Lane, Uyo" />
                        <p className="text-xs text-muted-foreground">This address will appear on printed receipts.</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="staff-id-length">Staff ID Length</Label>
                        <Input id="staff-id-length" type="number" min="4" max="10" value={staffIdLength} onChange={e => setStaffIdLength(Number(e.target.value))} />
                        <p className="text-xs text-muted-foreground">Sets the character length for staff IDs (4-10). Changing this will update all existing staff IDs.</p>
                    </div>
                </div>
                 <div className="space-y-4 p-4 border rounded-md">
                     <h4 className="font-semibold text-lg flex items-center gap-2"><Clock className="h-5 w-5"/> Time & Attendance</h4>
                     <Separator/>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="auto-clock-out">Auto Clock-Out Time</Label>
                            <Select value={autoClockOutTime} onValueChange={setAutoClockOutTime}>
                                <SelectTrigger id="auto-clock-out"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    {timeOptions.map(time => <SelectItem key={`out-${time}`} value={time}>{time}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Automatically clocks out all staff at this time.</p>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="clock-in-enabled">Clock-In Enabled Time</Label>
                             <Select value={clockInEnabledTime} onValueChange={setClockInEnabledTime}>
                                <SelectTrigger id="clock-in-enabled"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    {timeOptions.map(time => <SelectItem key={`in-${time}`} value={time}>{time}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Staff cannot clock in before this time.</p>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Save All Settings
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Changing the Staff ID length is an irreversible action that will modify all existing staff records. Please confirm you want to proceed.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSave}>Yes, I Understand</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    )
}

function DisableMfaDialog({ user, onDisabled }: { user: User, onDisabled: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [code, setCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const { toast } = useToast();

    const handleDisable = async () => {
        setIsVerifying(true);
        const result = await disableMfa(user.staff_id, code);
        if (result.success) {
            toast({ title: 'Success', description: 'MFA has been disabled.' });
            onDisabled();
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsVerifying(false);
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive">Disable MFA</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Disable Multi-Factor Authentication?</AlertDialogTitle>
                    <AlertDialogDescription>
                        For your security, please enter the 6-digit code from your authenticator app to confirm this action.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-2">
                    <Label htmlFor="disable-mfa-code" className="sr-only">MFA Code</Label>
                    <Input 
                        id="disable-mfa-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="text-center text-lg tracking-[0.3em]"
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisable} disabled={isVerifying || code.length !== 6}>
                        {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirm & Disable
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function SettingsPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [isMfaEnabled, setIsMfaEnabled] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'main' | 'setup' | 'verify'>('main');
    const [appSettings, setAppSettings] = useState({});

    // MFA Setup State
    const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            const parsedUser: User = JSON.parse(storedUser);
            setUser(parsedUser);

            const unsubUser = onSnapshot(doc(db, "staff", parsedUser.staff_id), (doc) => {
                if (doc.exists()) {
                    const data = doc.data();
                    setIsMfaEnabled(data.mfa_enabled || false);
                    setUser(prev => ({...prev!, ...data}));
                }
                if (isLoading) setIsLoading(false);
            });
            
            const unsubSettings = onSnapshot(doc(db, "settings", "app_config"), (doc) => {
                if(doc.exists()) {
                    setAppSettings(doc.data());
                }
            });

            return () => {
                unsubUser();
                unsubSettings();
            };
        } else {
            setIsLoading(false);
        }
    }, [isLoading]);
    
    const handleGenerateMfa = async () => {
        if (!user) return;
        setIsGenerating(true);
        try {
            const secret = speakeasy.generateSecret({ name: `BMS (${user.email})` });
            const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
            setMfaSetup({ secret: secret.base32, qrCode: qrCodeUrl });
            setView('setup');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate MFA setup key.' });
        }
        setIsGenerating(false);
    };

    const handleVerifyAndEnable = async () => {
        if (!user || !mfaSetup || !verificationCode) {
            toast({ variant: 'destructive', title: 'Error', description: 'Missing required information.' });
            return;
        }
        setIsVerifying(true);
        const result = await verifyMfaSetup(user.staff_id, verificationCode, mfaSetup.secret);
        if (result.success) {
            toast({ title: 'Success!', description: 'MFA has been enabled on your account.' });
            setView('main');
            setMfaSetup(null);
            setVerificationCode('');
        } else {
            toast({ variant: 'destructive', title: 'Verification Failed', description: result.error });
            setView('setup'); // Go back to QR code screen
        }
        setIsVerifying(false);
    };

    if (isLoading || isMfaEnabled === null || !user) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>
    }

    const canCustomizeStore = user.role === 'Manager' || user.role === 'Developer';

    return (
        <div className="flex flex-col gap-8">
            <h1 className="text-2xl font-bold font-headline">Settings</h1>

            {canCustomizeStore && <StoreCustomization currentSettings={appSettings} />}

            <ThemeSettings user={user} />
            
            <ChangePasswordForm user={user} />
            
            <Card>
                <CardHeader>
                    <CardTitle>Multi-Factor Authentication (MFA)</CardTitle>
                    <CardDescription>
                        Add an extra layer of security to your account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {view === 'main' && (
                         <Alert>
                            <ShieldCheck className="h-4 w-4" />
                            <AlertTitle>MFA Status: {isMfaEnabled ? <span className="text-green-500">Enabled</span> : <span className="text-destructive">Disabled</span>}</AlertTitle>
                            <AlertDescription>
                                {isMfaEnabled 
                                    ? "Your account is protected with an additional layer of security." 
                                    : "It's highly recommended to enable MFA to protect your account from unauthorized access."
                                }
                            </AlertDescription>
                            <div className="mt-4">
                                {isMfaEnabled ? (
                                   <DisableMfaDialog user={user} onDisabled={() => setIsMfaEnabled(false)} />
                                ) : (
                                    <Button onClick={handleGenerateMfa} disabled={isGenerating}>
                                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                        Enable MFA
                                    </Button>
                                )}
                            </div>
                        </Alert>
                    )}
                    {view === 'setup' && mfaSetup && (
                        <div className="space-y-4 text-center p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">Step 1: Scan QR Code</h3>
                            <p className="text-sm text-muted-foreground">Scan this QR code with an authenticator app (e.g., Google Authenticator, Authy).</p>
                             <div className="bg-white p-2 rounded-md inline-block">
                               <img src={mfaSetup.qrCode} alt="MFA QR Code" className="max-w-48"/>
                             </div>
                            <p className="text-xs text-muted-foreground">Or enter this key manually:</p>
                            <div className="flex items-center justify-center gap-2">
                                <code className="p-2 bg-muted rounded-md">{mfaSetup.secret}</code>
                                <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(mfaSetup.secret); toast({title: "Copied!"}) }}><Copy className="h-4 w-4"/></Button>
                            </div>
                             <div className="flex justify-center gap-2">
                                <Button variant="outline" onClick={() => setView('main')}>Cancel</Button>
                                <Button onClick={() => setView('verify')}>Next: Verify Code</Button>
                            </div>
                        </div>
                    )}
                    {view === 'verify' && (
                         <div className="space-y-4 text-center p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">Step 2: Verify Your Device</h3>
                            <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app to complete the setup.</p>
                             <div className="mx-auto max-w-xs space-y-2">
                                <Label htmlFor="verification-code" className="sr-only">Verification Code</Label>
                                <Input 
                                    id="verification-code"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    maxLength={6}
                                    placeholder="123456"
                                    className="text-center text-2xl tracking-[0.3em]"
                                />
                             </div>
                             <div className="flex gap-2 justify-center">
                                <Button variant="outline" onClick={() => { setView('setup'); setVerificationCode(''); }}>Back</Button>
                                <Button onClick={handleVerifyAndEnable} disabled={isVerifying || verificationCode.length !== 6}>
                                    {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Enable MFA
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
