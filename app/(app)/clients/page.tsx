"use client";

import { useMemo, useState } from "react";
import { Building } from "lucide-react";
import { EmptyState, PageHeader, PageIcon, SearchInput, SortTh, TableSkeleton, useSort } from "@/components/ui/bits";
import { useApi, useBrands } from "@/lib/client";
import type { Company } from "@/lib/types";

/** Read-only view of the company → brand relation that powers the autosuggest. */
export default function ClientsPage() {
  const { data: companies, isLoading } = useApi<Company[]>("/api/companies");
  const { data: brands = [] } = useBrands();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const loose = brands.filter((b) => !b.company).map((b) => ({ _id: b._id, name: b.name }));
    const all: Company[] = [...(companies || []), ...(loose.length ? [{ _id: "none", name: "— No company —", brands: loose }] : [])];
    const term = q.toLowerCase();
    return all.filter((c) => !term || c.name.toLowerCase().includes(term) || c.brands?.some((b) => b.name.toLowerCase().includes(term)));
  }, [companies, brands, q]);
  const { sorted, sort, toggle } = useSort(rows, { name: (c) => c.name, count: (c) => c.brands?.length || 0 });

  return (
    <>
      <PageHeader title="Companies & Brands" subtitle="Added automatically when you type them on a project. Similar spellings are matched to avoid duplicates."
        icon={<PageIcon><Building /></PageIcon>} />
      <div className="mb-3 flex items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search company or brand…" />
        {companies && <span className="ml-auto text-xs text-muted">{companies.length} companies · {brands.length} brands</span>}
      </div>
      {isLoading && !companies ? <TableSkeleton /> : sorted.length === 0 ? (
        <div className="card"><EmptyState title="Nothing found." /></div>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl">
            <thead>
              <tr>
                <SortTh label="Company" k="name" sort={sort} onSort={toggle} className="w-1/4" />
                <SortTh label="Brands" k="count" sort={sort} onSort={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c._id}>
                  <td className={`align-top font-semibold ${c._id === "none" ? "text-muted" : ""}`}>{c.name}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.brands?.length ? c.brands.map((b) => (
                        <span key={b._id} className={`chip ${q && b.name.toLowerCase().includes(q.toLowerCase()) ? "bg-accent text-[var(--accent-fg)]" : "bg-panel2 text-fg"}`}>{b.name}</span>
                      )) : <span className="text-xs text-muted">No brands yet</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
