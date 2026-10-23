// Samples: a client asked for a sample; it becomes a project only if they go ahead.
// Stored in `projects` with `sample: true` (so files, types, brands all work the same).

export type SampleStatus = "requested" | "working" | "sent" | "declined" | "converted";

export const SAMPLE_STATUS: Record<SampleStatus, { label: string; cls: string }> = {
  requested: { label: "Requested", cls: "bg-panel2 text-muted" },
  working: { label: "Working", cls: "bg-accent-soft text-accent" },
  sent: { label: "Sent to client", cls: "bg-accent text-[var(--accent-fg)]" },
  declined: { label: "Declined", cls: "bg-danger/10 text-danger" },
  converted: { label: "Became a project", cls: "bg-[#30d158]/15 text-[#30d158]" },
};

/** Statuses people pick by hand ("converted" happens through Convert to project). */
export const PICKABLE: SampleStatus[] = ["requested", "working", "sent", "declined"];
export const OPEN_STATUSES: SampleStatus[] = ["requested", "working", "sent"];
