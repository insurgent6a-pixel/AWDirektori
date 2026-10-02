import { Cinzel, Montserrat } from "next/font/google";

// The asiaworks.id faces: Montserrat for everything, Cinzel (classical Roman capitals) only for the wordmark.
// In a file of its own because two trees set them: the (aw) layout, and the 404 page, which sits outside that layout.
export const ui = Montserrat({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
export const brand = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-brand", display: "swap" });
