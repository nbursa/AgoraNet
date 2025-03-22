import "../globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
    <html lang={locale} className="h-full w-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col h-screen w-screen overflow-hidden`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main className="flex flex-col flex-1 w-full bg-gradient-to-b from-black to-gray-900 overflow-y-auto">
            <div className="w-full flex-1 flex flex-col">{children}</div>
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
