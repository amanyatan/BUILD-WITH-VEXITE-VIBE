export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 border rounded-lg shadow-sm ${className || ""}`}>{children}</div>;
}
