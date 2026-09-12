import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button className={cn("px-4 py-2 font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50", className)} {...props}>
      {children}
    </button>
  );
}
