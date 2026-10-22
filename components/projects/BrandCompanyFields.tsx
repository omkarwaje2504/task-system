"use client";

import { useMemo } from "react";
import { Building, Info, Tag } from "lucide-react";
import Combobox, { type ComboOption } from "@/components/ui/Combobox";
import { Field } from "@/components/ui/bits";
import { useApi, useBrands } from "@/lib/client";
import type { Company } from "@/lib/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Company + brand typeahead backed by the company→brand relation. Picking
 * a known brand fills in its company, and a warning shows when the typed
 * brand already belongs to a different company — so nobody creates
 * "Mocef" twice under two spellings.
 */
export default function BrandCompanyFields({
  company, brand, onCompany, onBrand,
}: { company: string; brand: string; onCompany: (v: string) => void; onBrand: (v: string) => void }) {
  const { data: brands = [] } = useBrands();
  const { data: companies = [] } = useApi<Company[]>("/api/companies");

  const companyOptions: ComboOption[] = useMemo(
    () => companies.map((c) => ({ value: c._id, label: c.name, hint: c.brands?.length ? `${c.brands.length} brand${c.brands.length === 1 ? "" : "s"}` : undefined })),
    [companies],
  );

  const chosenCompany = companies.find((c) => norm(c.name) === norm(company));
  const brandOptions: ComboOption[] = useMemo(() => {
    // Brands of the chosen company first, then everything else.
    const sorted = chosenCompany
      ? [...brands].sort((a, b) => Number(b.company?._id === chosenCompany._id) - Number(a.company?._id === chosenCompany._id))
      : brands;
    return sorted.map((b) => ({ value: b._id, label: b.name, hint: b.company?.name || "No company yet" }));
  }, [brands, chosenCompany]);

  const typedBrand = brands.find((b) => norm(b.name) === norm(brand));
  const conflict = typedBrand?.company && company.trim() && norm(typedBrand.company.name) !== norm(company);

  return (
    <div className="grid gap-x-2.5 sm:grid-cols-2">
      <Field label="Company" optional>
        <Combobox value={company} onChange={onCompany} options={companyOptions} placeholder="Start typing… e.g. Mayer" icon={<Building className="h-4 w-4" />} newLabel="New company" />
      </Field>
      <Field label="Brand" optional>
        <Combobox value={brand} onChange={onBrand} options={brandOptions} placeholder="Start typing… e.g. Mocef" icon={<Tag className="h-4 w-4" />} newLabel="New brand"
          onPick={(o) => {
            const b = brands.find((x) => x._id === o.value);
            if (b?.company) onCompany(b.company.name);
          }} />
      </Field>
      {conflict && (
        <p className="-mt-1 mb-3 flex items-start gap-1.5 rounded-md bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent sm:col-span-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          “{typedBrand!.name}” already belongs to {typedBrand!.company!.name}, so it will stay under {typedBrand!.company!.name}.
          <button type="button" className="ml-auto shrink-0 underline" onClick={() => onCompany(typedBrand!.company!.name)}>Use {typedBrand!.company!.name}</button>
        </p>
      )}
    </div>
  );
}
