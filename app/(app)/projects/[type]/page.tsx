"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import ProjectsView from "@/components/projects/ProjectsView";
import { TableSkeleton } from "@/components/ui/bits";

export default function ProjectsPage() {
  const { type } = useParams<{ type: string }>();
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ProjectsView key={type} typeSlug={type} />
    </Suspense>
  );
}
