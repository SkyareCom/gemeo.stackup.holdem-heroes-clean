import type { Metadata } from "next";
import { Doppio_One } from "next/font/google";
import UppercaseGuard from "@/components/UppercaseGuard";
import "./globals.css";
import "./button-standard.css";
import "./scenario-standard.css";
import "./unified-background.css";

const doppioOne = Doppio_One({ subsets: ["latin"], weight: "400", variable: "--font-doppio-one" });

export const metadata: Metadata = {
  title: "STACKUP HOLD'EM HEROES",
  description: "AI POKER PERFORMANCE SYSTEM.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={doppioOne.variable}>
      <head>
        <style>{`html body, html body *, html body *::before, html body *::after { text-transform: uppercase !important; }`}</style>
      </head>
      <body className="unified-background">
        <UppercaseGuard />
        {children}
      </body>
    </html>
  );
}
