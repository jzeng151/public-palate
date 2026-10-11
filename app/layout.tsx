import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Public Palate · Find your corner of New York",
  description: "Explore NYC restaurants by cuisine and health grade. Compare customer reviews across Google, Yelp, and Grubhub with Nimble.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><template dangerouslySetInnerHTML={{__html: `<!--
THESIS: A city catalog connects real inspection grades to source-backed diner reviews.
OWN-WORLD: Taxi yellow navigation, navy Barlow lettering, white photographic entries, official blue A, green B and orange C.
STORY: Search the city, open a restaurant, compare review platforms and rating tiers, save a place.
FIRST VIEWPORT: Yellow masthead, large left-aligned heading, search and three filters, compact three-column restaurant catalog. Details expand below the selected row.
FORM: User-selected city catalog, grounded candidate 6, overrides assigned candidate 5. Seed 37f8d1f1. Approved comp city-catalog.png. Staging is a catalog with an inline detail spread.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`}}/>{children}</body>
    </html>
  );
}
