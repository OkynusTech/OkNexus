import "@/app/globals.css";

import type { Metadata } from "next";

import { ThemeProvider } from "@/components/contexts/theme-provider";
import AuthProvider from "@/components/contexts/auth-provider";
import { MainNav } from "@/components/main-nav";
import StateHydrator from "@/components/StateHydrator";
import { inter } from "@/lib/fonts";

import { siteConfig } from "../config/site";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  metadataBase: new URL(siteConfig.getStartedUrl),
  description: siteConfig.description,
  keywords: [
    "Landing page template",
    "Components",
    "Shadcn",
    "Next.js",
    "React",
    "Tailwind CSS",
    "Radix UI",
  ],
  authors: [
    {
      name: "Mikolaj Dobrucki",
      url: "https://mikolajdobrucki.com",
    },
  ],
  creator: "mikolajdobrucki",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.getStartedUrl,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@mikolajdobrucki",
  },
  icons: {
    icon: "https://okynus.com/assets/Okynus_logo_png-DlXUS30F.png",
    apple: "https://okynus.com/assets/Okynus_logo_png-DlXUS30F.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }} className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-background antialiased`}>
        <AuthProvider>
          <ThemeProvider>
            <StateHydrator />
            <MainNav />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
