// The tab title. The page itself is a client component, which cannot export metadata.
export const metadata = { title: "Dasbor" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
