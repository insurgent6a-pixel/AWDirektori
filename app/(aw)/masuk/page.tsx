import type { Metadata } from "next";
import { LoginForm } from "../_components/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function MasukPage() {
  return <LoginForm />;
}
