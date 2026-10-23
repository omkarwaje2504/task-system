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

export const metadata: Metadata = {
  title: { default: "Studio Desk", template: "%s · Studio Desk" },
  description: "Projects, tasks and design assets for the studio team.",
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
