import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotFoundClient } from "@/components/not-found-client";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
       <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
       <Card className="w-full max-w-md shadow-2xl text-center">
        <CardHeader>
          <CardTitle className="font-headline text-4xl text-destructive">404</CardTitle>
          <CardDescription className="font-body text-lg">
            Oops! The page you're looking for could not be found.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground mb-6">It seems you've taken a wrong turn. Let's get you back on track.</p>
            <NotFoundClient />
        </CardContent>
      </Card>
    </main>
  );
}
