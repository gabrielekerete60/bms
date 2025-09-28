
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, ShoppingBag, Package, Users, LineChart, Settings, CircleUser, Pizza, Inbox,
  ChevronRight, Users2, Car, Wallet, BookOpen, Clock, PanelLeft, LogOut, LogIn, Loader2,
  HelpingHand, MessageSquare, Database, Trash, Wrench, Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getAttendanceStatus, handleClockIn, handleClockOut } from '../actions';
import { doc, onSnapshot, collection, query, where, orderBy, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { useAuth, ProtectedRoute } from '@/context/AuthContext';


type User = {
  name: string;
  role: string;
  staff_id: string;
  theme?: string;
};

type NavLink = {
    href: string;
    icon: React.ElementType;
    label: string;
    roles: string[];
    disabled?: boolean;
    sublinks?: Omit<NavLink, 'icon' | 'roles' | 'sublinks'>[];
    notificationKey?: string;
};

const SidebarFooter = ({ user, isClockedIn, isClocking, time, handleClockInOut, clockInEnabled, clockInDisabledReason }: { user: User, isClockedIn: boolean, isClocking: boolean, time: string, handleClockInOut: () => void, clockInEnabled: boolean, clockInDisabledReason: string | null }) => {
    return (
        <div className="mt-auto p-4 border-t shrink-0">
            <div className='flex items-center justify-between text-sm text-muted-foreground mb-2'>
                <span><Clock className="inline h-4 w-4 mr-1" />{time}</span>
                <Button variant={isClockedIn ? "destructive" : "outline"} size="sm" onClick={handleClockInOut} disabled={isClocking || !clockInEnabled}>
                    {isClocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (isClockedIn ? <LogOut className="mr-2 h-4 w-4"/> : <LogIn className="mr-2 h-4 w-4"/>)}
                    {isClocking ? 'Loading...' : (isClockedIn ? 'Clock Out' : (clockInDisabledReason || 'Clock In'))}
                </Button>
            </div>
            <Card>
                <CardContent className="p-2 flex items-center gap-2">
                    <Avatar>
                        <AvatarImage src="https://placehold.co/40x40.png" alt={user.name} data-ai-hint="profile person" />
                        <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className='font-semibold text-sm'>{user.name}</p>
                        <p className='text-xs text-muted-foreground'>Role: {user.role}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

function SidebarNav({ navLinks, pathname, notificationCounts }: { navLinks: NavLink[], pathname: string, notificationCounts: Record<string, number> }) {
  const { toast } = useToast();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const activeMenu = navLinks.find(link => link.sublinks?.some((sub:any) => pathname.startsWith(sub.href)));
    if (activeMenu) {
      setOpenMenu(activeMenu.label);
    }
  }, [pathname, navLinks]);
  
  const handleTriggerClick = (label: string) => {
    setOpenMenu(prevMenu => prevMenu === label ? null : label);
  };

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {navLinks.map((link) => 
        link.sublinks ? (
           <Collapsible 
              key={link.label} 
              className="grid gap-1"
              open={openMenu === link.label}
              onOpenChange={(isOpen) => {
                if (!isOpen && openMenu === link.label) {
                  setOpenMenu(null);
                }
              }}
            >
            <CollapsibleTrigger 
              onClick={() => handleTriggerClick(link.label)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary [&[data-state=open]>svg:last-child]:rotate-90"
            >
              <div className="flex items-center gap-3">
                <link.icon className="h-4 w-4" />
                {link.label}
                 {link.notificationKey && notificationCounts[link.notificationKey] > 0 && (
                    <Badge variant="destructive" className="ml-auto">{notificationCounts[link.notificationKey]}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 transition-transform" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden text-sm">
                <div className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down ml-7 flex flex-col gap-1 border-l pl-3 py-1">
                    {link.sublinks.map((sublink) => (
                    <Link 
                        key={sublink.label} 
                        href={sublink.disabled ? '#' : sublink.href}
                        onClick={(e) => {
                            if (sublink.disabled) {
                            e.preventDefault();
                            toast({ variant: 'destructive', title: 'Feature Not Available', description: 'This feature is currently under construction.' });
                            }
                        }}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary relative",
                            !sublink.disabled && pathname === sublink.href && "bg-muted text-primary",
                            sublink.disabled && "cursor-not-allowed opacity-50"
                            )}>
                        {sublink.label}
                        {sublink.notificationKey && notificationCounts[sublink.notificationKey] > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 w-5 flex items-center justify-center rounded-full p-0">{notificationCounts[sublink.notificationKey]}</Badge>
                        )}
                    </Link>
                    ))}
                </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <Link
            key={link.label}
            href={link.disabled ? '#' : link.href}
            onClick={(e) => {
                if (link.disabled) {
                    e.preventDefault();
                    toast({ variant: 'destructive', title: 'Feature Not Available', description: 'This feature is currently under construction.' });
                } else {
                  setOpenMenu(null);
                }
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
              !link.disabled && pathname.startsWith(link.href) && (link.href !== '/dashboard' || pathname === '/dashboard') && "bg-muted text-primary"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
             {link.notificationKey && notificationCounts[link.notificationKey] > 0 && (
                <Badge variant="destructive" className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    {notificationCounts[link.notificationKey]}
                </Badge>
            )}
          </Link>
        )
      )}
    </nav>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast } = useToast();
  const { user, login, logout } = useAuth();
  const [time, setTime] = useState('');
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [isClocking, setIsClocking] = useState(true);
  const [clockInEnabled, setClockInEnabled] = useState(true);
  const [clockInDisabledReason, setClockInDisabledReason] = useState<string | null>(null);
  const [timeSettings, setTimeSettings] = useState({ autoClockOutTime: '21:00', clockInEnabledTime: '06:00' });
  const [notificationCounts, setNotificationCounts] = useState({
      pendingTransfers: 0, activeRuns: 0, pendingBatches: 0, inProductionBatches: 0, 
      pendingPayments: 0, newReports: 0, inProgressReports: 0, unreadAnnouncements: 0,
      pendingApprovals: 0, returnedStock: 0, productionTransfers: 0,
  });

  const applyTheme = useCallback((theme?: string) => {
    const root = document.documentElement;
    const themes = ['theme-midnight', 'theme-forest', 'theme-rose-gold', 'theme-classic-light', 'theme-slate', 'theme-crimson', 'theme-emerald', 'theme-abyss', 'theme-sunset', 'theme-solaris', 'theme-oceanic', 'theme-lavender', 'theme-vintage', 'theme-sakura'];
    root.classList.remove(...themes);
    if (theme && theme !== 'default') {
      root.classList.add(`theme-${theme}`);
    }
  }, []);

  useEffect(() => {
    if (user?.theme) {
      applyTheme(user.theme);
    }
  }, [user?.theme, applyTheme]);
  
  const handleClockInOut = async () => {
    if (!user) return;
    setIsClocking(true);
    if (isClockedIn) {
      if (attendanceId) {
        const result = await handleClockOut(attendanceId);
        if (result.success) {
          setIsClockedIn(false);
          setAttendanceId(null);
          toast({ title: "Clocked Out", description: "You have successfully clocked out." });
        } else {
          toast({ variant: 'destructive', title: "Error", description: result.error });
        }
      }
    } else {
      const result = await handleClockIn(user.staff_id);
      if (result.success && result.attendanceId) {
        setIsClockedIn(true);
        setAttendanceId(result.attendanceId);
        toast({ title: "Clocked In", description: "You have successfully clocked in." });
      } else {
        toast({ variant: 'destructive', title: "Error", description: result.error });
      }
    }
    window.dispatchEvent(new CustomEvent('attendanceChanged'));
    setIsClocking(false);
  };

  useEffect(() => {
    if (!user?.staff_id) return;

    const checkAttendance = async () => {
        setIsClocking(true);
        try {
            const status = await getAttendanceStatus(user.staff_id);
            if (status) {
                setIsClockedIn(true);
                setAttendanceId(status.attendanceId);
            } else {
                setIsClockedIn(false);
                setAttendanceId(null);
            }
        } catch (error) {
            console.error("Failed to check attendance status:", error);
        } finally {
            setIsClocking(false);
        }
    };
    checkAttendance();
    
    // Time-based logic timer
    const timer = setInterval(() => {
        const now = new Date();
        setTime(now.toLocaleTimeString());
        
        // Auto clock-out logic
        const [autoHour, autoMinute] = timeSettings.autoClockOutTime.split(':').map(Number);
        if (now.getHours() === autoHour && now.getMinutes() === autoMinute && now.getSeconds() === 0 && isClockedIn && attendanceId) {
            handleClockOut(attendanceId).then(result => {
                if (result.success) {
                     toast({ title: "Auto Clocked Out", description: "You have been automatically clocked out for the day." });
                     setIsClockedIn(false);
                     setAttendanceId(null);
                }
            });
        }
        
        // Clock-in enabled logic
        const [enabledHour, enabledMinute] = timeSettings.clockInEnabledTime.split(':').map(Number);
        const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
        const enabledTimeInMinutes = enabledHour * 60 + enabledMinute;
        
        if (!isClockedIn) {
            if (currentTimeInMinutes < enabledTimeInMinutes) {
                setClockInEnabled(false);
                setClockInDisabledReason(`Until ${timeSettings.clockInEnabledTime}`);
            } else {
                setClockInEnabled(true);
                setClockInDisabledReason(null);
            }
        } else {
             setClockInEnabled(true);
             setClockInDisabledReason(null);
        }
    }, 1000);

    const unsubSettings = onSnapshot(doc(db, "settings", "app_config"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setTimeSettings({
                autoClockOutTime: data.autoClockOutTime || '21:00',
                clockInEnabledTime: data.clockInEnabledTime || '06:00',
            });
        }
    });

    const pendingTransfersQuery = query(collection(db, "transfers"), where('to_staff_id', '==', user.staff_id), where('status', '==', 'pending'));
    const unsubPending = onSnapshot(pendingTransfersQuery, (snap) => setNotificationCounts(prev => ({...prev, pendingTransfers: snap.size })));
    
    const activeRunsQuery = query(collection(db, "transfers"), where('to_staff_id', '==', user.staff_id), where('status', '==', 'active'));
    const unsubActiveRuns = onSnapshot(activeRunsQuery, (snap) => setNotificationCounts(prev => ({...prev, activeRuns: snap.size })));

    const pendingBatchesQuery = query(collection(db, 'production_batches'), where('status', '==', 'pending_approval'));
    const unsubBatches = onSnapshot(pendingBatchesQuery, (snap) => setNotificationCounts(prev => ({...prev, pendingBatches: snap.size })));
    
    const inProductionBatchesQuery = query(collection(db, 'production_batches'), where('status', '==', 'in_production'));
    const unsubInProduction = onSnapshot(inProductionBatchesQuery, (snap) => {
        const bakerBatches = snap.docs.filter(d => d.data().requestedById === user.staff_id);
        setNotificationCounts(prev => ({ ...prev, inProductionBatches: bakerBatches.length }));
    });

    const pendingPaymentsQuery = query(collection(db, 'payment_confirmations'), where('status', '==', 'pending'));
    const unsubPayments = onSnapshot(pendingPaymentsQuery, (snap) => setNotificationCounts(prev => ({...prev, pendingPayments: snap.size })));

    const newReportsQuery = query(collection(db, 'reports'), where('status', '==', 'new'));
    const unsubReports = onSnapshot(newReportsQuery, (snap) => setNotificationCounts(prev => ({...prev, newReports: snap.size })));
    
    const inProgressReportsQuery = query(collection(db, 'reports'), where('status', '==', 'in_progress'));
    const unsubInProgress = onSnapshot(inProgressReportsQuery, (snap) => setNotificationCounts(prev => ({...prev, inProgressReports: snap.size })));

    const qApprovals = query(collection(db, "supply_requests"), where('status', '==', 'pending'));
    const unsubApprovals = onSnapshot(qApprovals, (snapshot) => {
        setNotificationCounts(prev => ({...prev, pendingApprovals: snapshot.size }));
    });
    
    const returnedStockQuery = query(collection(db, 'transfers'), where('status', '==', 'pending_return'));
    const unsubReturnedStock = onSnapshot(returnedStockQuery, (snap) => setNotificationCounts(prev => ({...prev, returnedStock: snap.size })));

    const productionTransfersQuery = query(collection(db, 'transfers'), where('notes', '>=', 'Return from production batch'), where('notes', '<', 'Return from production batch' + '\uf8ff'), where('status', '==', 'pending'));
    const unsubProductionTransfers = onSnapshot(productionTransfersQuery, (snap) => setNotificationCounts(prev => ({ ...prev, productionTransfers: snap.size })));


    const announcementsQuery = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'));
    const unsubAnnouncements = onSnapshot(announcementsQuery, (snap) => {
        const lastReadTimestamp = localStorage.getItem(`lastReadAnnouncement_${user.staff_id}`);
        const newCount = snap.docs.filter(doc => {
            if (doc.data().staffId === user.staff_id) {
                return false;
            }
            if (!lastReadTimestamp) return true;
            const timestamp = doc.data().timestamp;
            if (!timestamp) return true;
            return timestamp.toDate() > new Date(lastReadTimestamp);
        }).length;
        setNotificationCounts(prev => ({...prev, unreadAnnouncements: newCount }));
    });

    const handleAnnouncementsRead = () => {
        setNotificationCounts(prev => ({...prev, unreadAnnouncements: 0 }));
    }
    
    window.addEventListener('announcementsRead', handleAnnouncementsRead);
    
    const userDocRef = doc(db, 'staff', user.staff_id);
    const unsubUserDoc = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const freshUserData = docSnap.data();
            if (user?.theme !== freshUserData.theme) {
                const updatedUser = { ...user, theme: freshUserData.theme };
                login(updatedUser); 
            }
        }
    });

    return () => {
        clearInterval(timer);
        unsubPending();
        unsubActiveRuns();
        unsubBatches();
        unsubInProduction();
        unsubPayments();
        unsubReports();
        unsubAnnouncements();
        unsubInProgress();
        unsubApprovals();
        unsubReturnedStock();
        unsubProductionTransfers();
        unsubUserDoc();
        unsubSettings();
        window.removeEventListener('announcementsRead', handleAnnouncementsRead);
    };
  }, [user?.staff_id, user?.theme, login, timeSettings.autoClockOutTime, timeSettings.clockInEnabledTime, isClockedIn, attendanceId, toast]);
  
  const navLinks: NavLink[] = useMemo(() => {
    const allLinks: NavLink[] = [
      { href: "/dashboard", icon: Home, label: "Dashboard", roles: ['Manager', 'Supervisor', 'Accountant', 'Showroom Staff', 'Delivery Staff', 'Baker', 'Storekeeper', 'Developer'] },
      { href: "/dashboard/pos", icon: ShoppingBag, label: "POS", roles: ['Supervisor', 'Showroom Staff', 'Developer'] },
      {
        icon: Inbox, label: "Orders", roles: ['Manager', 'Supervisor', 'Showroom Staff', 'Accountant', 'Developer'], sublinks: [
          { href: "/dashboard/orders/regular", label: "Regular Orders" },
          { href: "#", label: "Custom Orders", disabled: true },
        ]
      },
      {
        icon: Package, label: "Inventory", roles: ['Manager', 'Supervisor', 'Baker', 'Storekeeper', 'Accountant', 'Showroom Staff', 'Developer', 'Delivery Staff'], notificationKey: "inventory", sublinks: [
          { href: "/dashboard/inventory/products", label: "Products", roles: ['Manager', 'Supervisor', 'Storekeeper', 'Accountant', 'Developer'] },
          { href: "/dashboard/inventory/recipes", label: "Recipes & Production", roles: ['Manager', 'Supervisor', 'Baker', 'Storekeeper', 'Developer'], notificationKey: "production" },
          { href: "/dashboard/inventory/ingredients", label: "Ingredients", roles: ['Manager', 'Supervisor', 'Storekeeper', 'Accountant', 'Developer'] },
          { href: "/dashboard/inventory/suppliers", label: "Suppliers", roles: ['Manager', 'Supervisor', 'Storekeeper', 'Accountant', 'Developer'] },
          { href: "/dashboard/inventory/stock-control", label: "Stock Control", notificationKey: "stockControl", roles: ['Manager', 'Supervisor', 'Storekeeper', 'Delivery Staff', 'Showroom Staff', 'Baker', 'Developer'] },
          { href: "/dashboard/inventory/other-supplies", label: "Other Supplies", roles: ['Manager', 'Supervisor', 'Storekeeper', 'Accountant', 'Developer'] },
          { href: "/dashboard/inventory/waste-logs", label: "Waste Logs", roles: ['Manager', 'Developer', 'Storekeeper', 'Delivery Staff', 'Showroom Staff', 'Accountant'] },
        ]
      },
      {
        icon: Users, label: "Customers", roles: ['Manager', 'Supervisor', 'Developer'], sublinks: [
          { href: "/dashboard/customers/profiles", label: "Profiles" },
          { href: "#", label: "Feedback", disabled: true },
          { href: "#", label: "Loyalty Programs", disabled: true },
        ]
      },
       {
        icon: Users2, label: "Staff", roles: ['Manager', 'Supervisor', 'Developer'], sublinks: [
          { href: "/dashboard/staff/management", label: "Staff Management" },
          { href: "/dashboard/staff/attendance", label: "Attendance" },
          { href: "/dashboard/staff/payroll", label: "Payroll", disabled: false },
        ]
      },
      { href: "/dashboard/deliveries", icon: Car, label: "Deliveries", notificationKey: "activeRuns", roles: ['Manager', 'Supervisor', 'Accountant', 'Delivery Staff', 'Developer'], disabled: false },
      { href: "/dashboard/accounting", icon: Wallet, label: "Accounting", notificationKey: "accounting", roles: ['Manager', 'Accountant', 'Developer'] },
      { href: "/dashboard/promotions", icon: LineChart, label: "Promotions", roles: ['Manager', 'Supervisor', 'Developer'], disabled: true },
      { href: "/dashboard/communication", icon: MessageSquare, label: "Communication", notificationKey: "communication", roles: ['Manager', 'Supervisor', 'Accountant', 'Showroom Staff', 'Delivery Staff', 'Baker', 'Storekeeper', 'Developer'] },
      { href: "/dashboard/documentation", icon: BookOpen, label: "Documentation", roles: ['Manager', 'Supervisor', 'Accountant', 'Showroom Staff', 'Delivery Staff', 'Baker', 'Storekeeper', 'Developer'] },
      { href: "/dashboard/settings", icon: Settings, label: "Settings", roles: ['Manager', 'Supervisor', 'Accountant', 'Showroom Staff', 'Delivery Staff', 'Baker', 'Storekeeper', 'Developer'] },
    ];

    if (!user) return [];

    const filterLinks = (links: NavLink[]): NavLink[] => {
      return links.reduce((acc: NavLink[], link) => {
        if (link.roles.includes(user.role)) {
          if (link.sublinks) {
            const filteredSublinks = (link.sublinks as NavLink[]).filter((sublink) => {
              if (sublink.href === "/dashboard/inventory/stock-control" && user.role === 'Baker') {
                return false;
              }
              if (sublink.href === "/dashboard/inventory/recipes" && user.role === 'Storekeeper') {
                  return false;
              }
              return !sublink.roles || sublink.roles.includes(user.role)
            });
            if (filteredSublinks.length > 0) {
              acc.push({ ...link, sublinks: filteredSublinks });
            }
          } else {
            acc.push(link);
          }
        }
        return acc;
      }, []);
    };
    
    return filterLinks(allLinks);

  }, [user]);

  const combinedNotificationCounts = useMemo(() => {
    if (!user) return {};
    const canApproveBatches = ['Manager', 'Developer', 'Storekeeper'].includes(user.role);
    const isStorekeeper = user.role === 'Storekeeper';
    const isBaker = ['Baker', 'Chief Baker'].includes(user.role);
    const isManagerial = ['Manager', 'Developer', 'Supervisor'].includes(user.role);
    
    let productionCount = 0;
    if (isBaker) {
        productionCount = notificationCounts.inProductionBatches;
    } else if (canApproveBatches) {
        productionCount = notificationCounts.pendingBatches;
    }

    const stockControlCount = notificationCounts.pendingTransfers + 
                              (isStorekeeper ? notificationCounts.pendingBatches : 0) +
                              (isStorekeeper ? notificationCounts.productionTransfers : 0) +
                              (isStorekeeper ? notificationCounts.returnedStock : 0);
                              
    const inventoryCount = stockControlCount + productionCount;
    const accountingCount = notificationCounts.pendingPayments + notificationCounts.pendingApprovals;
    
    const communicationCount = isManagerial 
        ? notificationCounts.newReports + notificationCounts.inProgressReports + notificationCounts.unreadAnnouncements
        : notificationCounts.unreadAnnouncements;

      return {
          stockControl: stockControlCount,
          batchApprovals: notificationCounts.pendingBatches,
          returnedStock: notificationCounts.returnedStock,
          productionTransfers: notificationCounts.productionTransfers,
          activeRuns: notificationCounts.activeRuns,
          production: productionCount,
          inventory: inventoryCount, // Aggregate for main inventory badge
          accounting: accountingCount,
          payments: notificationCounts.pendingPayments,
          approvals: notificationCounts.pendingApprovals,
          communication: communicationCount,
          unreadAnnouncements: notificationCounts.unreadAnnouncements,
          actionableReports: notificationCounts.newReports + notificationCounts.inProgressReports
      }
  }, [notificationCounts, user]);

  if (!user) {
    return null; // The ProtectedRoute HOC will handle the redirect
  }
  
  return (
    <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:flex md:flex-col h-screen">
        <div className="flex h-14 shrink-0 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Pizza className="h-6 w-6 text-primary" />
            <span className="font-headline">BMS</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav navLinks={navLinks} pathname={pathname} notificationCounts={combinedNotificationCounts} />
        </div>
        <SidebarFooter user={user} isClockedIn={isClockedIn} isClocking={isClocking} time={time} handleClockInOut={handleClockInOut} clockInEnabled={clockInEnabled} clockInDisabledReason={clockInDisabledReason} />
      </div>
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex h-full flex-col p-0 w-full max-w-xs sm:max-w-sm">
                  <SheetHeader className="h-14 shrink-0 border-b px-4 lg:h-[60px]">
                     <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                      <Pizza className="h-6 w-6 text-primary" />
                      <span className="font-headline">BMS</span>
                    </Link>
                  </SheetHeader>
                <div className="overflow-y-auto flex-1 py-2">
                    <SidebarNav navLinks={navLinks} pathname={pathname} notificationCounts={combinedNotificationCounts} />
                </div>
                 <SidebarFooter user={user} isClockedIn={isClockedIn} isClocking={isClocking} time={time} handleClockInOut={handleClockInOut} clockInEnabled={clockInEnabled} clockInDisabledReason={clockInDisabledReason} />
              </SheetContent>
            </Sheet>
          <div className="w-full flex-1"></div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <CircleUser className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/dashboard/settings" passHref>
                <DropdownMenuItem>Settings</DropdownMenuItem>
              </Link>
              <Link href="/dashboard/support" passHref>
                <DropdownMenuItem disabled>Support</DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => logout()}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
          <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
          {children}
        </main>
      </div>
    </div>
  );
}


export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </ProtectedRoute>
    )
}
