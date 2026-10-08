import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { OrgProvider } from "@/context/OrgContext";
import { SeparationProvider } from "@/context/SeparationContext";
import { PerformanceProvider } from "@/context/PerformanceContext";
import { LearningProvider } from "@/context/LearningContext";
import { VisaProvider } from "@/context/VisaContext";
import { ExpiryProvider } from "@/context/ExpiryContext";
import { ExpenseProvider } from "@/context/ExpenseContext";
import { RequestsProvider } from "@/context/RequestsContext";
import { DocumentsProvider } from "@/context/DocumentsContext";
import { AppShell } from "@/components/shell/AppShell";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GS HRMS · Employee Management",
  description: "Global Surf IT — Employee Management module",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <OrgProvider>
          <AppProvider>
            <SeparationProvider>
              <PerformanceProvider>
                <LearningProvider>
                  <VisaProvider>
                    <ExpiryProvider>
                      <ExpenseProvider>
                        <RequestsProvider><DocumentsProvider>
                          <AppShell>{children}</AppShell>
                        </DocumentsProvider></RequestsProvider>
                      </ExpenseProvider>
                    </ExpiryProvider>
                  </VisaProvider>
                </LearningProvider>
              </PerformanceProvider>
            </SeparationProvider>
          </AppProvider>
        </OrgProvider>
      </body>
    </html>
  );
}
