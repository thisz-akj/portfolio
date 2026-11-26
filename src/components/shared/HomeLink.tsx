import Link from "next/link";
import { House } from "lucide-react";

/** Small "Home" pill back to the main page. Used in the site header (off the home page) and the demo apps. */
export function HomeLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`home-pill ${className}`.trim()} aria-label="Home: back to the main page">
      <House size={13} strokeWidth={1.75} aria-hidden />
      <span>Home</span>
    </Link>
  );
}
