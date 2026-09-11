import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Cram — Chat with your course materials",
    template: "%s · Cram",
  },
  description:
    "Upload your syllabus, lecture slides, and readings. Cram answers your questions, writes summaries, and quizzes you — grounded in your own materials.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b10" },
  ],
};

/**
 * Applies the saved theme before first paint so there's no flash of the wrong
 * palette. Kept inline and tiny; it runs before React hydrates.
 */
const themeScript = `
(function() {
  try {
    var saved = localStorage.getItem('cram-theme');
    var dark = saved ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

/**
 * Whop Pixel for ad attribution (business biz_pvfPuCkAj705k8).
 *
 * Reproduced verbatim from the snippet Whop issued — the loader is
 * minified and order-sensitive, so nothing here is reformatted. Living in
 * the root layout puts it in the <head> of every route, which is what
 * https://docs.whop.com/developer/ads/pixel asks for.
 *
 * Note it fires track("page") once, on load. Next's client-side navigation
 * doesn't reload the document, so in-app route changes aren't counted as
 * separate page views. That's fine for ad attribution, where what matters is
 * the landing hit that carries the ad click.
 */
const whopPixel = `!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_pvfPuCkAj705k8");whop.track("page");`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: whopPixel }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
