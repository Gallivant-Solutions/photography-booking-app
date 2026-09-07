import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="panel flex max-w-[440px] flex-col items-start gap-4 p-8">
        <div className="kicker">404</div>
        <h1 className="font-heading text-[30px] leading-[1.06] text-text">That page isn&apos;t here</h1>
        <p className="text-[15px] leading-[1.55] text-neutral-700">
          If you followed a booking link, ask the photographer for a fresh one — links are tied to the device that started them.
        </p>
        <Button href="/">Back to the start</Button>
      </div>
    </div>
  );
}
