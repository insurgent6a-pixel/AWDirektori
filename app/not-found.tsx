import Link from "next/link";
import { inter } from "./(aw)/_lib/font";

// An address that does not exist. This file belongs to the host site (a site that already has its own 404 keeps
// that one); it is here so this project does not fall back to Next's English page.
// It sits outside the (aw) layout, so it brings the typeface itself.
export default function NotFound() {
  return (
    <div className={`${inter.variable} aw grid place-items-center px-4 text-center`}>
      <div>
        <p className="eyebrow">404</p>
        <h1 className="h-section mt-2">Halaman tidak ditemukan</h1>
        <p className="body-copy mx-auto mt-2 max-w-sm text-sm">Alamatnya mungkin salah ketik, atau halamannya sudah dipindah.</p>
        <Link
          href="/direktori"
          className="tap mt-6 inline-flex h-11 items-center rounded-xl bg-maroon px-5 text-sm font-semibold text-white shadow-button hover:bg-maroon-dark"
        >
          Ke Direktori
        </Link>
      </div>
    </div>
  );
}
