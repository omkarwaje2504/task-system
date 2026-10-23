import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import ToastHost from "@/components/ui/ToastHost";
import ConfirmHost from "@/components/ui/ConfirmHost";
import TapGlow from "@/components/ui/TapGlow";
import { APPEARANCE_KEY, applyAppearance } from "@/lib/appearance";
import "./globals.css";

// SF Pro on Apple devices; Inter (its closest open match) everywhere else.
// The optical-size axis gives Inter the same Text/Display switch SF Pro has.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], axes: ["opsz"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION = "Projects, tasks and design assets for the studio team.";

// Absolute base for share images: APP_URL (e.g. https://desk.example.com), else Vercel's production URL.
const siteUrl = process.env.APP_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

// Icons, the share image and the manifest come from app/icon.svg, apple-icon.tsx,
// opengraph-image.tsx, twitter-image.tsx and manifest.ts.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Task System", template: "%s · Task System" },
  description: DESCRIPTION,
  applicationName: "Task System",
  openGraph: { type: "website", siteName: "Task System", title: "Task System", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "Task System", description: DESCRIPTION },
  appleWebApp: { capable: true, title: "Task System", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Dark by default; drops it before first paint if light was picked, and
// applies the saved appearance settings (a local copy of the account's) — no flash.
const themeScript = `try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}
try{(${applyAppearance.toString()})(JSON.parse(localStorage.getItem('${APPEARANCE_KEY}')||'null'))}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        {children}
        <ToastHost />
        <ConfirmHost />
        <TapGlow />
      </body>
    </html>
  );
}
