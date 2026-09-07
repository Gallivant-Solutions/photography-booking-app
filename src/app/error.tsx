"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const envIssue = /Invalid server environment/.test(error.message);
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="panel flex max-w-[480px] flex-col items-start gap-4 p-8">
        <div className="kicker">Something went wrong</div>
        <h1 className="font-heading text-[28px] leading-[1.06] text-text">{envIssue ? "The app isn't configured yet" : "That didn't work"}</h1>
        <p className="text-[14.5px] leading-[1.55] text-neutral-700">
          {envIssue ? error.message : "Nothing was lost. Try again, and if it keeps happening, reply to any email from us."}
        </p>
        {error.digest ? <p className="text-[12px] text-neutral-600">Ref {error.digest}</p> : null}
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
