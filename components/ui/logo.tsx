import { ShieldCheck } from 'lucide-react';

export function Logo({ className = "", iconClassName = "h-6 w-6" }: { className?: string, iconClassName?: string }) {
  return (
    <div className={`flex items-center gap-2 font-bold text-xl ${className}`}>
      <div className="flex items-center justify-center rounded-md bg-primary/10 p-1">
        <ShieldCheck className={`text-primary ${iconClassName}`} />
      </div>
      <span className="bg-gradient-to-tr from-purple-600 to-blue-600 bg-clip-text text-transparent">
        OkNexus
      </span>
    </div>
  );
}
