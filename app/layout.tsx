import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { demoResearch, demoSend } from "@/lib/config";

export const metadata: Metadata = { title: "HANA · Newsletter builder" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authOn = !!process.env.APP_PASSWORD;
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans">
        <header className="border-b border-gray-200">
          <div className="mx-auto flex h-16 max-w-[1250px] items-center justify-between px-6">
            <Link href="/" className="text-xl font-extrabold tracking-tight">
              HANA<span className="text-brand">.</span>
            </Link>
            <nav className="flex items-center gap-1 text-[15px]">
              <Link href="/" className="rounded-md px-3 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/lists" className="rounded-md px-3 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                Email lists
              </Link>
              <Link href="/new" className="ml-2 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
                New newsletter
              </Link>
              {authOn && (
                <form action="/api/logout" method="post">
                  <button className="ml-2 rounded-md px-3 py-2 text-gray-500 hover:bg-gray-100">Sign out</button>
                </form>
              )}
            </nav>
          </div>
        </header>
        {(demoResearch || demoSend) && (
          <div className="bg-amber-50 text-center text-sm text-amber-900">
            <div className="mx-auto max-w-[1250px] px-6 py-2">
              <strong>Demo mode:</strong>{" "}
              {demoResearch && "sample articles instead of live research (set TAVILY_API_KEY and ANTHROPIC_API_KEY)"}
              {demoResearch && demoSend && "; "}
              {demoSend && "emails are logged, not sent (set RESEND_API_KEY)"}.
            </div>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
