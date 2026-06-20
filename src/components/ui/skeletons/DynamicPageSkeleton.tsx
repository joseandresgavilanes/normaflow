"use client";

import { usePathname } from "next/navigation";
import { resolvePageSkeleton } from "@/lib/skeleton-route";

export default function DynamicPageSkeleton() {
  const pathname = usePathname();
  const Skeleton = resolvePageSkeleton(pathname);
  return <Skeleton />;
}
