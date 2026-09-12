import { useAppStore } from "@/store";
import Link from "next/link";

export function Header() {
  const user = useAppStore((state) => state.user);

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <Link href="/" className="text-xl font-bold">Vibe</Link>
      <div>
        {user ? <span>{user}</span> : <Link href="/login">Sign In</Link>}
      </div>
    </header>
  );
}
