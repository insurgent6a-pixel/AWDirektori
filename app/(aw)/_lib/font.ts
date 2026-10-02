import { Inter } from "next/font/google";

// One typeface for everything. opsz: big sizes get Inter's display cut (tighter, finer) by themselves.
// In a file of its own because two trees set it: the (aw) layout, and the 404 page, which sits outside that layout.
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", axes: ["opsz"] });
