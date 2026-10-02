"use client";

// Shown when a page of the directory throws, in place of Next's own English "This page couldn't load".
// It sits inside the directory's layout, so the header and the bottom bar stay usable.

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Container } from "./_components/shell";
import { Button, Empty } from "./_components/ui";

export default function AwError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Container className="py-10">
      <Empty
        icon={<TriangleAlert className="h-6 w-6" />}
        title="Halaman ini belum bisa dibuka"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>Coba lagi</Button>
            <Button href="/" variant="secondary">
              Ke Direktori
            </Button>
          </div>
        }
      >
        Ada yang tidak beres di sisi kami. Coba lagi sebentar ya.
      </Empty>
    </Container>
  );
}
