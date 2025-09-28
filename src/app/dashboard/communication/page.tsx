

"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, Eye, BellDot, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { postAnnouncement, submitReport, Announcement as AnnouncementType, getReports, Report, updateReportStatus, getStaffList } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, onSnapshot, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


type User = {
    name: string;
    role: string;
    staff_id: string;
};

type StaffMember = {
    id: string;
    name: string;
}

function PaginationControls({
    visibleRows,
    setVisibleRows,
    totalRows
}: {
    visibleRows: number | 'all',
    setVisibleRows: (val: number | 'all') => void,
    totalRows: number
}) {
    const [inputValue, setInputValue] = useState<string>('');

    const handleApply = () => {
        const num = parseInt(inputValue, 10);
        if (!isNaN(num) && num > 0) {
            setVisibleRows(num);
        }
    };

    return (
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <span>Show:</span>
            <Button variant={visibleRows === 10 ? "default" : "outline"} size="sm" onClick={() => setVisibleRows(10)}>10</Button>
            <Button variant={visibleRows === 20 ? "default" : "outline"} size="sm" onClick={() => setVisibleRows(20)}>20</Button>
            <Button variant={visibleRows === 50 ? "default" : "outline"} size="sm" onClick={() => setVisibleRows(50)}>50</Button>
            <Button variant={visibleRows === 'all' ? "default" : "outline"} size="sm" onClick={() => setVisibleRows('all')}>All ({totalRows})</Button>
             <div className="flex items-center gap-1">
                <Input 
                    type="number" 
                    className="h-8 w-16" 
                    placeholder="Custom"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                />
                <Button size="sm" onClick={handleApply}>Apply</Button>
            </div>
        </div>
    )
}

function ReportForm({ user, onReportSubmitted }: { user: User | null, onReportSubmitted: () => void }) {
    const { toast } = useToast();
    const [subject, setSubject] = useState('');
    const [reportType, setReportType] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !reportType || !message || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all fields.' });
            return;
        }

        setIsSubmitting(true);
        const result = await submitReport({ subject, reportType, message, user });

        if (result.success) {
            toast({ title: 'Success', description: 'Your report has been submitted.' });
            setSubject('');
            setReportType('');
            setMessage('');
            onReportSubmitted();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Submit a Report</CardTitle>
                <CardDescription>File a formal report for incidents, suggestions, or maintenance needs.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g., Faulty Mixer in Kitchen" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="report-type">Report Type</Label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger id="report-type">
                                    <SelectValue placeholder="Select a type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Incident">Incident</SelectItem>
                                    <SelectItem value="Suggestion">Suggestion</SelectItem>
                                    <SelectItem value="Maintenance">Maintenance Request</SelectItem>
                                    <SelectItem value="Complaint">Complaint</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="message">Detailed Message</Label>
                        <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Please provide as much detail as possible." rows={6} />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Report
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function ReportDetailDialog({ report, isOpen, onOpenChange, onStatusChange }: { report: Report | null, isOpen: boolean, onOpenChange: (open: boolean) => void, onStatusChange: () => void }) {
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);

    if (!report) return null;

    const handleUpdateStatus = async (newStatus: Report['status']) => {
        setIsUpdating(true);
        const result = await updateReportStatus(report.id, newStatus);
        if (result.success) {
            toast({ title: 'Success', description: `Report status updated to "${newStatus.replace('_', ' ')}".` });
            onStatusChange();
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsUpdating(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{report.subject}</DialogTitle>
                    <DialogDescription>
                        Report by {report.staffName} on {report.timestamp ? format(report.timestamp.toDate(), 'PPp') : 'Date not available'}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="flex items-center gap-4">
                        <Badge variant="secondary">{report.reportType}</Badge>
                        <Badge>{report.status.replace('_', ' ')}</Badge>
                    </div>
                    <Separator />
                    <p className="text-sm whitespace-pre-wrap">{report.message}</p>
                </div>
                <DialogFooter className="justify-between">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>Close</Button>
                    <div className="flex gap-2">
                        {report.status === 'new' && <Button onClick={() => handleUpdateStatus('in_progress')} disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark as In Progress</Button>}
                        {report.status === 'in_progress' && <Button onClick={() => handleUpdateStatus('resolved')} disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark as Resolved</Button>}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ViewReportsTab() {
    const [reports, setReports] = useState<Report[]>([]);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [notificationCounts, setNotificationCounts] = useState({ new: 0, inProgress: 0 });

    // Filtering and pagination state
    const [activeTab, setActiveTab] = useState('new');
    const [visibleRows, setVisibleRows] = useState<number | 'all'>(10);
    const [viewingReport, setViewingReport] = useState<Report | null>(null);
    const [typeFilter, setTypeFilter] = useState('all');
    const [staffFilter, setStaffFilter] = useState('all');


     const fetchReports = useCallback(() => {
        // No need to set loading here as onSnapshot handles it
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                return { id: doc.id, ...docData } as Report;
            });
            setReports(data);
             // Update notification counts
            const newCount = data.filter(r => r.status === 'new').length;
            const inProgressCount = data.filter(r => r.status === 'in_progress').length;
            setNotificationCounts({ new: newCount, inProgress: inProgressCount });
            if (isLoading) setIsLoading(false);
        }, (error) => {
            console.error("Error fetching reports:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch reports.' });
            if (isLoading) setIsLoading(false);
        });

        return () => unsubscribe();
    }, [toast, isLoading]);

    useEffect(() => {
        const unsubscribe = fetchReports();
        
        getStaffList().then(staff => {
            setStaffList(staff);
        });

        return () => unsubscribe();
    }, [fetchReports]);


    const filteredReports = useMemo(() => {
        return reports.filter(report => {
            const statusMatch = report.status.replace('_', ' ') === activeTab;
            const typeMatch = typeFilter === 'all' || report.reportType === typeFilter;
            const staffMatch = staffFilter === 'all' || report.staffId === staffFilter;
            return statusMatch && typeMatch && staffMatch;
        });
    }, [reports, activeTab, typeFilter, staffFilter]);
    
    const paginatedReports = useMemo(() => {
        return visibleRows === 'all' ? filteredReports : filteredReports.slice(0, visibleRows);
    }, [filteredReports, visibleRows]);

    const getStatusVariant = (status: Report['status']) => {
        switch (status) {
            case 'new': return 'destructive';
            case 'in_progress': return 'default';
            case 'resolved': return 'outline';
            default: return 'outline';
        }
    }

    const getTypeVariant = (type: string) => {
        switch (type) {
            case 'Complaint': return 'destructive';
            case 'Maintenance': return 'secondary';
            default: return 'outline';
        }
    }
    
    const reportTypes = ['all', 'Incident', 'Suggestion', 'Maintenance', 'Complaint', 'Other'];

    return (
        <>
            <ReportDetailDialog 
                report={viewingReport} 
                isOpen={!!viewingReport} 
                onOpenChange={() => setViewingReport(null)}
                onStatusChange={() => {}} // Listener handles this
            />
             <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="new" className="relative">
                        New {notificationCounts.new > 0 && <Badge variant="destructive" className="ml-2">{notificationCounts.new}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="in progress" className="relative">
                        In Progress {notificationCounts.inProgress > 0 && <Badge className="ml-2">{notificationCounts.inProgress}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="resolved">Resolved</TabsTrigger>
                </TabsList>
                <TabsContent value={activeTab} className="mt-4">
                     <Card>
                        <CardHeader>
                           <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <CardTitle>Reports - <span className="capitalize">{activeTab.replace('_', ' ')}</span></CardTitle>
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                     <Select value={typeFilter} onValueChange={setTypeFilter}>
                                        <SelectTrigger className="w-full sm:w-[180px]">
                                            <SelectValue placeholder="Filter by type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {reportTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                     <Select value={staffFilter} onValueChange={setStaffFilter}>
                                        <SelectTrigger className="w-full sm:w-[180px]">
                                            <SelectValue placeholder="Filter by staff" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Staff</SelectItem>
                                            {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="md:hidden space-y-4">
                                {isLoading ? (
                                     <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin"/></div>
                                ) : paginatedReports.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-12">No reports found.</p>
                                ) : (
                                    paginatedReports.map(report => (
                                        <Card key={report.id} className="p-4" onClick={() => setViewingReport(report)}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold">{report.subject}</p>
                                                    <p className="text-sm text-muted-foreground">{report.staffName}</p>
                                                    <p className="text-xs text-muted-foreground">{report.timestamp ? format(report.timestamp.toDate(), 'PPp') : 'N/A'}</p>
                                                </div>
                                                <Badge variant={getTypeVariant(report.reportType)}>{report.reportType}</Badge>
                                            </div>
                                        </Card>
                                    ))
                                )}
                            </div>
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>From</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Subject</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                                        ) : paginatedReports.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="h-24 text-center">No reports found in this category.</TableCell></TableRow>
                                        ) : (
                                            paginatedReports.map(report => (
                                                <TableRow key={report.id}>
                                                    <TableCell>{report.timestamp ? format(report.timestamp.toDate(), 'PPp') : 'N/A'}</TableCell>
                                                    <TableCell>{report.staffName}</TableCell>
                                                    <TableCell><Badge variant={getTypeVariant(report.reportType)}>{report.reportType}</Badge></TableCell>
                                                    <TableCell>{report.subject}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => setViewingReport(report)}>
                                                            <Eye className="mr-2 h-4 w-4"/>View
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <PaginationControls visibleRows={visibleRows} setVisibleRows={setVisibleRows} totalRows={filteredReports.length} />
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </>
    );
}


export default function CommunicationPage() {
    const { toast } = useToast();
    const [announcements, setAnnouncements] = useState<AnnouncementType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState("announcements");
    const [notificationCounts, setNotificationCounts] = useState({ unreadAnnouncements: 0, actionableReports: 0 });
    const [showMarkAsRead, setShowMarkAsRead] = useState(false);


    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (!storedUser) {
            if (isLoading) setIsLoading(false);
            return;
        }
        
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);
        const isManagerial = ['Manager', 'Developer', 'Supervisor'].includes(parsedUser.role);

        const qAnnouncements = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'));
        const unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                 const docData = doc.data();
                return { id: doc.id, ...docData } as AnnouncementType;
            });
            setAnnouncements(data);

            const lastReadTimestamp = localStorage.getItem(`lastReadAnnouncement_${parsedUser.staff_id}`);
            const newCount = data.filter(doc => {
                if (doc.staffId === parsedUser.staff_id) return false;
                if (!lastReadTimestamp) return true;
                if (!doc.timestamp) return true;
                return doc.timestamp.toDate() > new Date(lastReadTimestamp);
            }).length;
            
            setNotificationCounts(prev => ({...prev, unreadAnnouncements: newCount }));
            setShowMarkAsRead(newCount > 0);

            if (isLoading) setIsLoading(false);
        }, (error) => {
            console.error("Error fetching announcements:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch announcements.'});
            if (isLoading) setIsLoading(false);
        });

        let unsubReports: () => void = () => {};
        if (isManagerial) {
            const qReports = query(collection(db, 'reports'), where('status', 'in', ['new', 'in_progress']));
            unsubReports = onSnapshot(qReports, (snapshot) => {
                setNotificationCounts(prev => ({...prev, actionableReports: snapshot.size }));
            });
        }
        
        const handleAnnouncementsRead = () => {
            setNotificationCounts(prev => ({...prev, unreadAnnouncements: 0 }));
            setShowMarkAsRead(false);
        }
        
        window.addEventListener('announcementsRead', handleAnnouncementsRead);

        return () => {
            unsubAnnouncements();
            unsubReports();
            window.removeEventListener('announcementsRead', handleAnnouncementsRead);
        };
    }, [toast, isLoading]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
    }

    const handlePostAnnouncement = async () => {
        if (!newMessage.trim() || !user) return;

        setIsPosting(true);
        const result = await postAnnouncement(newMessage, user);

        if (result.success) {
            setNewMessage('');
            toast({ title: 'Success', description: 'Your announcement has been posted.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsPosting(false);
    };

    const handleMarkAllRead = () => {
        if (!user) return;
        localStorage.setItem(`lastReadAnnouncement_${user.staff_id}`, new Date().toISOString());
        window.dispatchEvent(new Event('announcementsRead'));
        toast({ title: 'Messages Marked as Read' });
    }

    const canPostAnnouncements = user?.role === 'Manager' || user?.role === 'Supervisor' || user?.role === 'Developer';
    const canViewReports = user?.role === 'Manager' || user?.role === 'Supervisor' || user?.role === 'Developer';
    
    const combinedNotificationCount = useMemo(() => {
        if (!user) return 0;
        const isManagerial = ['Manager', 'Developer', 'Supervisor'].includes(user.role);
        return isManagerial
            ? notificationCounts.actionableReports + notificationCounts.unreadAnnouncements
            : notificationCounts.unreadAnnouncements;
    }, [user, notificationCounts]);


    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold font-headline">Communication Center</h1>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList>
                    <TabsTrigger value="announcements" className="relative">
                        Announcements
                        {notificationCounts.unreadAnnouncements > 0 && <Badge variant="destructive" className="ml-2">{notificationCounts.unreadAnnouncements}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="submit-report">Submit a Report</TabsTrigger>
                    {canViewReports && (
                        <TabsTrigger value="view-reports" className="relative">
                            View Reports
                            {notificationCounts.actionableReports > 0 && <Badge variant="destructive" className="ml-2">{notificationCounts.actionableReports}</Badge>}
                        </TabsTrigger>
                    )}
                </TabsList>
                <TabsContent value="announcements" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div>
                                <CardTitle>Team Announcements</CardTitle>
                                <CardDescription>Updates and messages from management.</CardDescription>
                            </div>
                            {showMarkAsRead && (
                                <Button variant="outline" onClick={handleMarkAllRead}>
                                    <CheckCheck className="mr-2 h-4 w-4"/> Mark All as Read
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4 h-96 overflow-y-auto p-4 border rounded-md">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                    </div>
                                ) : announcements.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        No announcements yet.
                                    </div>
                                ) : (
                                    announcements.map((announcement) => (
                                        <div key={announcement.id} className="flex items-start gap-4">
                                            <Avatar>
                                                <AvatarImage src={`https://placehold.co/40x40.png?text=${announcement.staffName.charAt(0)}`} alt={announcement.staffName} data-ai-hint="person face" />
                                                <AvatarFallback>{announcement.staffName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold">{announcement.staffName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {announcement.timestamp ? format(announcement.timestamp.toDate(), 'PPp') : 'Sending...'}
                                                    </p>
                                                </div>
                                                <p className="text-sm">{announcement.message}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {canPostAnnouncements && (
                                <div className="relative">
                                    <Textarea
                                        placeholder="Type your announcement..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="pr-16"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handlePostAnnouncement();
                                            }
                                        }}
                                    />
                                    <Button
                                        size="icon"
                                        className="absolute right-2 bottom-2"
                                        onClick={handlePostAnnouncement}
                                        disabled={isPosting || !newMessage.trim()}
                                    >
                                        {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="submit-report" className="mt-4">
                    <ReportForm user={user} onReportSubmitted={() => setActiveTab("announcements")} />
                </TabsContent>
                 {canViewReports && (
                    <TabsContent value="view-reports" className="mt-4">
                       <ViewReportsTab />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
