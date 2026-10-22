"use client";

import Link from "next/link";
import { ChevronRight, Images } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { EmptyState, PageHeader, PageIcon, TableSkeleton } from "@/components/ui/bits";
import { coverOf } from "@/components/assets/AssetModals";
import { fmtDate, useApi, useMe, useTypes } from "@/lib/client";
import type { Asset } from "@/lib/types";

export default function AssetsHome() {
  const { data: me } = useMe();
  const { data: types, isLoading } = useTypes();
  const { data: assets = [] } = useApi<Asset[]>("/api/assets");
  const libs = (types || []).filter((t) => t.assetTab).map((t) => {
    const items = assets.filter((a) => a.productType === t._id);
    return { t, items, covers: items.map(coverOf).filter((f) => f?.kind === "image").slice(0, 6) };
  });

  return (
    <>
      <PageHeader title="Assets" subtitle="The team's design library, one shelf per product type." icon={<PageIcon><Images /></PageIcon>} />
      {isLoading && !types ? <TableSkeleton rows={4} /> : libs.length === 0 ? (
        <div className="card">
          <EmptyState title="No asset libraries yet." hint="An admin can turn on “Asset tab” for any product type."
            action={me?.role === "admin" && <Link className="btn-primary" href="/product-types">Open Product Types</Link>} />
        </div>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl">
            <thead>
              <tr><th>Library</th><th className="text-right">Designs</th><th className="hidden md:table-cell">Latest covers</th><th className="hidden sm:table-cell">Last added</th><th className="w-6" /></tr>
            </thead>
            <tbody>
              {libs.map(({ t, items, covers }) => (
                <tr key={t._id}>
                  <td>
                    <Link href={`/assets/${t.slug}`} className="flex items-center gap-2 font-semibold hover:text-accent">
                      <TypeIcon icon={t.icon} size="sm" />{t.name} designs
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{items.length}</td>
                  <td className="hidden !py-1.5 md:table-cell">
                    <span className="flex gap-1">
                      {covers.length ? covers.map((c) => (
                        // eslint-disable-next-line @next/next/no-img-element -- user uploads on an arbitrary R2 domain
                        <img key={c!.url} src={c!.url} alt="" loading="lazy" className="h-10 w-8 rounded object-cover" />
                      )) : <span className="text-xs text-muted">—</span>}
                    </span>
                  </td>
                  <td className="hidden text-muted sm:table-cell">{items[0] ? fmtDate(items[0].createdAt) : "—"}</td>
                  <td><Link href={`/assets/${t.slug}`} className="text-muted hover:text-accent" aria-label={`Open ${t.name} designs`}><ChevronRight className="h-4 w-4" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
