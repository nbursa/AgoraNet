import "../globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileSidebar from "@/components/MobileSidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function LocaleLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { children, params } = props;
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className="w-full"
      style={{
        height: "100%",
        minHeight: "100vh",
        WebkitOverflowScrolling: "touch",
        position: "relative",
      }}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: "100vh",
          width: "100%",
          position: "relative",
          WebkitTextSizeAdjust: "100%",
        }}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <MobileSidebar />
          <main
            className="flex-1 w-full bg-gradient-to-b from-black to-gray-900 overflow-y-auto"
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="flex flex-col items-center w-full mx-auto"
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {children}
            </div>
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
