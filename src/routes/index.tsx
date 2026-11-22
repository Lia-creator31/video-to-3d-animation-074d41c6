import { createFileRoute } from "@tanstack/react-router";

import { GardenExperience } from "@/components/GardenExperience";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Di Bawah Lengkungan Mawar — Animasi 3D Taman" },
      {
        name: "description",
        content:
          "Animasi 3D lengkap dari adegan pertama hingga terakhir: pasangan berjalan di taman mawar, duduk di bangku kayu, dikelilingi hewan taman, hingga tarian kupu-kupu.",
      },
      { property: "og:title", content: "Di Bawah Lengkungan Mawar — Animasi 3D Taman" },
      {
        property: "og:description",
        content: "Saksikan kisah animasi 3D di bawah lengkungan mawar dari adegan pertama hingga penutup.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <GardenExperience />;
}
