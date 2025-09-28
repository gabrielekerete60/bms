
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, KeyRound, User, Pizza, ShieldCheck, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { handleLogin, verifyMfa } from "./actions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'login' | 'mfa'>('login');
  const [staffId, setStaffId] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [staffIdLength, setStaffIdLength] = useState(6); // Default length
  const router = useRouter();
  const { toast } = useToast();
  const { user, login, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    // Force default theme on login page
    const root = document.documentElement;
    const themes = ['theme-midnight', 'theme-forest', 'theme-rose-gold', 'theme-classic-light', 'theme-slate', 'theme-crimson', 'theme-emerald', 'theme-abyss', 'theme-sunset', 'theme-solaris', 'theme-oceanic', 'theme-lavender', 'theme-vintage', 'theme-sakura'];
    root.classList.remove(...themes);

    if (!isAuthLoading && user) {
      router.push('/dashboard');
      return; 
    }

    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'app_config'));
        if (settingsDoc.exists()) {
          setStaffIdLength(settingsDoc.data().staffIdLength || 6);
        }
      } catch (error) {
        console.error("Failed to fetch app settings:", error);
      }
    };
    fetchSettings();
  }, [user, isAuthLoading, router]);


  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const staffIdValue = formData.get("staff_id") as string;
    setStaffId(staffIdValue);
    
    const result = await handleLogin(formData);

    if (result.success) {
        if (result.mfaRequired) {
            setView('mfa');
        } else if (result.user) {
            toast({
                title: "Login Successful",
                description: `Welcome back, ${result.user.name}!`,
            });
            login(result.user);
        }
    } else {
        toast({
            variant: "destructive",
            title: "Login Failed",
            description: result.error,
        });
        localStorage.removeItem('loggedInUser');
    }
    setIsLoading(false);
  };
  
  const handleMfaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    const result = await verifyMfa(staffId, mfaToken);

    if (result.success && result.user) {
        toast({
            title: "Login Successful",
            description: `Welcome back, ${result.user.name}!`,
        });
        login(result.user);
    } else {
        toast({
            variant: "destructive",
            title: "MFA Failed",
            description: result.error || "Invalid MFA token.",
        });
    }
    setIsLoading(false);
  }

  const renderLoginView = () => (
    <Card className="w-full max-w-sm shadow-2xl bg-card/80 backdrop-blur-sm border-primary/20">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2">
                <Pizza className="h-8 w-8 text-primary" />
                <CardTitle className="text-3xl font-headline text-primary">BMS</CardTitle>
            </div>
          <CardDescription className="font-body pt-2">Welcome to the Bakery Management System. Please log in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="login-form" onSubmit={handleLoginSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="relative">
                <Label htmlFor="staff_id" className="font-headline text-primary-foreground/80 block mb-1.5">Staff ID</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input id="staff_id" name="staff_id" placeholder={`Your ${staffIdLength}-character ID`} maxLength={staffIdLength} className="transition-all duration-300 focus:bg-background pl-10" required />
                </div>
              </div>
              <div className="relative">
                <Label htmlFor="password" className="font-headline text-primary-foreground/80 block mb-1.5">Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="Your password" className="transition-all duration-300 focus:bg-background pl-10" required/>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors duration-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="remember-me" name="remember-me" />
                <Label htmlFor="remember-me" className="text-sm font-normal font-body">Remember me</Label>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" form="login-form" className="w-full font-headline" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Login
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Need to manage the database?{" "}
            <Link href="/database-tools" className="underline hover:text-primary transition-colors">
              Go to Database Tools
            </Link>
          </p>
        </CardFooter>
      </Card>
  );
  
  const renderMfaView = () => (
    <Card className="w-full max-w-sm shadow-2xl bg-card/80 backdrop-blur-sm border-primary/20">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <CardTitle className="text-3xl font-headline text-primary">Two-Factor Authentication</CardTitle>
            </div>
          <CardDescription className="font-body pt-2">Enter the code from your authenticator app.</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="mfa-form" onSubmit={handleMfaSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="relative">
                <Label htmlFor="mfa_token" className="font-headline text-primary-foreground/80 block mb-1.5">6-Digit Code</Label>
                <Input 
                    id="mfa_token" 
                    name="mfa_token" 
                    placeholder="123456" 
                    maxLength={6} 
                    className="transition-all duration-300 focus:bg-background text-center text-lg tracking-[0.5em]" 
                    required 
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value)}
                />
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" form="mfa-form" className="w-full font-headline" disabled={isLoading || mfaToken.length !== 6}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>
           <Button variant="link" onClick={() => setView('login')} className="text-xs">
            Back to Login
          </Button>
        </CardFooter>
      </Card>
  )
  
  if (isAuthLoading || user) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-full bg-background -z-10" />
      {view === 'login' ? renderLoginView() : renderMfaView()}
    </main>
  );
}
