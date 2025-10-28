import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { ErrorMonitoringProvider } from "@/providers/ErrorMonitoringProvider";
import { Toaster } from "react-hot-toast";
import ClientOnly from "@/components/ClientOnly";
import TutorialOverlay from "@/components/TutorialOverlay";

const kanit = Kanit({
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin', 'thai'],
  display: 'swap',
  variable: '--font-kanit',
});

export const metadata: Metadata = {
  title: "Inventory Management Dashboard",
  description: "ระบบจัดการคลังสินค้าและแจ้งปัญหา IT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={kanit.variable}>
      <body suppressHydrationWarning={true}>
        <ClientOnly>
          <ErrorMonitoringProvider enableDashboard={false} enableGlobalHandling={true}>
            <AuthProvider>
              <TutorialProvider>
                {children}
                <TutorialOverlay />
              </TutorialProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#fff',
                  color: '#333',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  maxWidth: '500px',
                  padding: '16px',
                },
                success: {
                  style: {
                    background: '#d4edda',
                    color: '#155724',
                    border: '1px solid #c3e6cb',
                  },
                },
                error: {
                  style: {
                    background: '#f8d7da',
                    color: '#721c24',
                    border: '1px solid #f1b0b7',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    position: 'relative',
                  },
                },
              }}
            />
            </AuthProvider>
          </ErrorMonitoringProvider>
        </ClientOnly>
      </body>
    </html>
  );
}
