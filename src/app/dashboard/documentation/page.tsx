
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type User = {
    name: string;
    role: string;
    staff_id: string;
};

const documentation: Record<string, React.ReactNode> = {
    Manager: (
        <>
            <p className="mb-4">As a Manager, you have full access to all modules of the BMS. Your primary responsibilities include overseeing operations, managing staff, analyzing performance, and making strategic decisions.</p>
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="dashboard">
                    <AccordionTrigger>Dashboard</AccordionTrigger>
                    <AccordionContent>The main dashboard provides a real-time overview of key metrics like revenue, sales, and active orders. Use this to gauge the daily health of the business.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="pos">
                    <AccordionTrigger>Point of Sale (POS)</AccordionTrigger>
                    <AccordionContent>Process customer orders, handle payments, and manage the sales floor. You can hold orders or clear the cart as needed.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="staff">
                    <AccordionTrigger>Staff Management</AccordionTrigger>
                    <AccordionContent>Add, edit, or deactivate staff accounts. Monitor attendance and manage payroll information. Your role and the Supervisor's are the only ones with access to this section.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="inventory">
                    <AccordionTrigger>Inventory</AccordionTrigger>
                    <AccordionContent>You have full control over inventory, including adding new products and ingredients, managing suppliers, creating recipes, and initiating stock transfers.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="accounting">
                    <AccordionTrigger>Accounting</AccordionTrigger>
                    <AccordionContent>Generate Profit & Loss statements, manage creditors, log expenses, and approve payment requests from staff.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="communication">
                    <AccordionTrigger>Communication</AccordionTrigger>
                    <AccordionContent>Post announcements to the entire team and review reports submitted by staff.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </>
    ),
    Supervisor: (
         <>
            <p className="mb-4">As a Supervisor, you have broad access to operational modules to assist the Manager. You can manage staff, oversee sales, and handle inventory and communication.</p>
             <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="pos">
                    <AccordionTrigger>Point of Sale (POS)</AccordionTrigger>
                    <AccordionContent>Process customer orders, handle payments, and manage the sales floor. You can hold orders or clear the cart as needed.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="staff">
                    <AccordionTrigger>Staff Management</AccordionTrigger>
                    <AccordionContent>You have the same staff management capabilities as the Manager, including adding/editing staff and viewing attendance.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="inventory">
                    <AccordionTrigger>Inventory</AccordionTrigger>
                    <AccordionContent>You have full control over inventory, including products, ingredients, suppliers, and stock transfers.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="communication">
                    <AccordionTrigger>Communication</AccordionTrigger>
                    <AccordionContent>You can post announcements to the entire team and review reports submitted by staff.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </>
    ),
    Accountant: (
         <>
            <p className="mb-4">As the Accountant, your dashboard is focused on the financial health of the bakery. You have read-only access to some operational data to help with your tasks.</p>
             <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="accounting">
                    <AccordionTrigger>Accounting Module</AccordionTrigger>
                    <AccordionContent>This is your primary workspace. You can generate P&L statements, view and manage payments to creditors, and log all business expenses.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="orders">
                    <AccordionTrigger>Orders</AccordionTrigger>
                    <AccordionContent>You have view-access to all past and present orders to reconcile sales records with financial data.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="inventory">
                    <AccordionTrigger>Inventory</AccordionTrigger>
                    <AccordionContent>You have view-access to inventory data, which is crucial for calculating Cost of Goods Sold (COGS) and understanding asset value.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="communication">
                    <AccordionTrigger>Communication</AccordionTrigger>
                    <AccordionContent>You can view company-wide announcements and submit your own reports for any issues or suggestions.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </>
    ),
     'Showroom Staff': (
         <>
            <p className="mb-4">As Showroom Staff, your primary focus is on sales and customer interaction.</p>
             <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="pos">
                    <AccordionTrigger>Point of Sale (POS)</AccordionTrigger>
                    <AccordionContent>This is your main tool. Use it to process all customer sales, take payments, and manage your cash drawer.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="orders">
                    <AccordionTrigger>Orders</AccordionTrigger>
                    <AccordionContent>You can view all orders to track sales and check on past transactions.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="communication">
                    <AccordionTrigger>Communication</AccordionTrigger>
                    <AccordionContent>Stay updated with management announcements and use the "Submit a Report" feature to communicate any issues or ideas.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </>
    ),
    'Delivery Staff': (
         <>
            <p className="mb-4">As Delivery Staff, your dashboard is streamlined for field operations.</p>
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="deliveries">
                    <AccordionTrigger>Deliveries</AccordionTrigger>
                    <AccordionContent>This is your main page. Here you will see "Active Runs" assigned to you by a manager or storekeeper. Review the items and notes before heading out. Once a run is active, you can manage customer sales and payments from the run details page. Completed runs will also appear here.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="communication">
                    <AccordionTrigger>Communication</AccordionTrigger>
                    <AccordionContent>Check for important announcements from management before starting your day. You can also submit reports, for example, to confirm a credit payment from a customer or report a vehicle issue.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </>
    ),
    'Driver': (
        <>
           <p className="mb-4">The Driver role is currently not in use. Functionality for this role will be defined at a later time.</p>
       </>
   ),
     Baker: (
         <>
            <p className="mb-4">As a Baker, your focus is on production and managing ingredients.</p>
            <Accordion type="single" collapsible className="w-full">
                 <AccordionItem value="inventory">
                    <AccordionTrigger>Inventory</AccordionTrigger>
                    <AccordionContent>Your main view is the Inventory section. Check product recipes, see current ingredient stock levels, and monitor production batches. You will need to request ingredients from the storekeeper for your production runs.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="communication">
                    <AccordionTrigger>Communication</AccordionTrigger>
                    <AccordionContent>Keep an eye on announcements for daily production targets. Use the "Submit a Report" feature for maintenance requests (e.g., "Faulty Oven") or suggestions.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </>
    ),
     Storekeeper: (
         <>
            <p className="mb-4">As the Storekeeper, you are the gatekeeper of all stock.</p>
            <Accordion type="single" collapsible className="w-full">
                 <AccordionItem value="inventory">
                    <AccordionTrigger>Inventory</AccordionTrigger>
                    <AccordionContent>This is your domain. You are responsible for managing all products, ingredients, and supplies. Key tasks include:
                    <ul className="list-disc pl-6 mt-2">
                        <li>Receiving goods from suppliers and logging them in the "Suppliers" tab.</li>
                        <li>Initiating stock transfers to sales staff using the "Stock Control" page.</li>
                        <li>Approving ingredient requests from bakers for production.</li>
                    </ul>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="communication">
                    <AccordionTrigger>Communication</AccordionTrigger>
                    <AccordionContent>Check for announcements and submit reports related to stock levels or supplier issues.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </>
    ),
    // Default message for other roles
    default: (
        <p>Welcome to the Bakery Management System. Your dashboard is customized based on your role. Please explore your available menu items to perform your duties.</p>
    )
};

export default function DocumentationPage() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const roleDocumentation = user ? (documentation[user.role] || documentation.default) : documentation.default;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold font-headline">Documentation</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user ? user.name : 'User'}!</CardTitle>
          <CardDescription>
            Here’s a quick guide on how to use your dashboard as a/an <strong>{user ? user.role : 'Employee'}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {roleDocumentation}
        </CardContent>
      </Card>
    </div>
  );
}
