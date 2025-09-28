
import { getSalesRunDetails, getAllSalesRuns, SalesRun } from '@/app/actions';
import { SalesRunDetailsPageClient } from './client';

type SalesRunDetailsProps = {
    params: {
        runId: string;
    }
}

// This function tells Next.js which dynamic pages to build at build time.
export async function generateStaticParams() {
    try {
        const { active, completed } = await getAllSalesRuns();
        const allRuns = [...active, ...completed];
        return allRuns.map((run) => ({
            runId: run.id,
        }));
    } catch (error) {
        console.error("Failed to generate static params for sales runs:", error);
        return [];
    }
}

export default async function SalesRunPage({ params }: SalesRunDetailsProps) {
    const { runId } = params;
    const runDetails = await getSalesRunDetails(runId);

    if (!runDetails) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <h1 className="text-2xl font-bold">Sales Run Not Found</h1>
                <p className="text-muted-foreground">The sales run with ID "{runId}" could not be found.</p>
            </div>
        )
    }

    return <SalesRunDetailsPageClient initialRun={runDetails} />;
}
