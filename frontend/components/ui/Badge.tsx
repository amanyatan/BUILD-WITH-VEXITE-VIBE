import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Badge({ children, variant = "default", className }: { children: React.ReactNode; variant?: string; className?: string }) {
  const variants = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    destructive: "bg-red-100 text-red-800",
  };
  return <span className={cn("px-2 py-1 text-xs font-semibold rounded-full", variants[variant as keyof typeof variants] || variants.default, className)}>{children}</span>;
}
