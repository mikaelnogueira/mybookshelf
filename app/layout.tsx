import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Libre_Baskerville } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const serif = Libre_Baskerville({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description = "Uma biblioteca pessoal local-first para organizar livros, acompanhar leituras e guardar o que importa.";
  return {
    metadataBase: new URL(origin),
    title: { default: "MyBookshelf", template: "%s · MyBookshelf" },
    description,
    applicationName: "MyBookshelf",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MyBookshelf" },
    openGraph: {
      type: "website",
      url: origin,
      title: "MyBookshelf — sua biblioteca viva",
      description,
      images: [{ url: `${origin}/og.png`, width: 1792, height: 934, alt: "Painel de leitura do MyBookshelf" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "MyBookshelf — sua biblioteca viva",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geist.variable} ${mono.variable} ${serif.variable}`}>
        {children}
      </body>
    </html>
  );
}
