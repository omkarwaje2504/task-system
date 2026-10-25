// Shared (client + server) definitions for product types, workflow
// templates and project steps.

export type StepKind = "check" | "link" | "languages" | "quantity" | "printer";
export type StepStatus = "todo" | "doing" | "done";

export type StepTemplate = { id: string; title: string; hint?: string; kind: StepKind };

export type VoiceState = { text: boolean; audio: boolean; assignee: string | null };
export type LanguageRow = { id: string; name: string; male: VoiceState; female: VoiceState };

export type StepData = {
  // languages
  voices?: ("male" | "female")[];
  languages?: LanguageRow[];
  // quantity (RxPad-style daily count)
  unit?: string;
  target?: number | null;
  totals?: { added: number; completed: number; declined: number };
  // printer
  printer?: string | null;
  printerName?: string;
};

/**
 * A unit of work in a project. Steps and tasks are the same thing: the
 * product type's template seeds the first ones, and people add more one by
 * one (tasks imported from the old tracker became steps too).
 */
export type ProjectStep = StepTemplate & {
  status: StepStatus;
  /** User ids. */
  assignees: string[];
  dueDate: string | null;
  /** Details / latest update. */
  note: string;
  link: string;
  doneAt: string | null;
  doneByName: string | null;
  data: StepData;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  /** IT projects: the module (page / part / section) this task belongs to. Empty = General. */
  module?: string;
};

/**
 * Checklist: plain tick boxes, separate from steps (no people, dates or
 * panels). A product type may define one (e.g. Calendar: Size confirmed →
 * Sent for printing); every new project of that type gets its own copy.
 */
export type ChecklistTemplate = { id: string; title: string };
export type ChecklistItem = ChecklistTemplate & { done: boolean; doneAt: string | null; doneByName: string | null };

export const checklistFromTemplate = (tpl: ChecklistTemplate[] = []): ChecklistItem[] =>
  tpl.map((t) => ({ id: uid(), title: t.title, done: false, doneAt: null, doneByName: null }));

export function cleanChecklistTemplate(v: unknown): ChecklistTemplate[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c) => c && String(c.title || "").trim())
    .map((c) => ({ id: typeof c.id === "string" && c.id ? c.id : uid(), title: String(c.title).trim().slice(0, 120) }))
    .slice(0, 40);
}

/** A type uses its checklist only when switched on and it has items. */
export const checklistEnabled = (t?: { checklistOn?: boolean; checklist?: ChecklistTemplate[] } | null) =>
  !!t?.checklistOn && !!t.checklist?.length;

/** For lists: how far through, the last item ticked, and the next one to do (first unticked, in order). */
export function checklistStatus(items: ChecklistItem[] = []) {
  const ticked = items.filter((c) => c.done);
  const last = ticked.reduce<ChecklistItem | null>((a, b) => (!a || (b.doneAt || "") > (a.doneAt || "") ? b : a), null);
  return { done: ticked.length, total: items.length, last, next: items.find((c) => !c.done) || null };
}

export const cleanModule =(v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 80);

/** A step's people (older steps stored a single `assignee`). */
export function stepPeople(step: Pick<ProjectStep, "assignees"> & { assignee?: string | null }): string[] {
  return step.assignees ?? (step.assignee ? [step.assignee] : []);
}

export const STEP_KINDS: Record<StepKind, { label: string; help: string }> = {
  check: { label: "Simple step", help: "Someone does it, then ticks it as done." },
  link: { label: "Step with a link", help: "Paste a link (client link, video link…) when done." },
  languages: { label: "Language videos", help: "Male & female video per language, each with text setting and audio." },
  quantity: { label: "Daily count", help: "Log how many were added / completed / declined each day (like RxPad)." },
  printer: { label: "Send to printer", help: "Pick a printer from Printer Types." },
};

export const COMMON_LANGUAGES = [
  "English", "Hindi", "Marathi", "Gujarati", "Tamil", "Telugu",
  "Kannada", "Bengali", "Malayalam", "Punjabi", "Odia", "Assamese", "Urdu",
];

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const voice = (): VoiceState => ({ text: false, audio: false, assignee: null });

export function languageRow(name: string): LanguageRow {
  return { id: uid(), name, male: voice(), female: voice() };
}

/** Turns template steps into fresh project steps. */
export function stepsFromTemplate(tpl: StepTemplate[], opts: { languages?: string[] } = {}): ProjectStep[] {
  return tpl.map((t) => {
    const data: StepData = {};
    if (t.kind === "languages") {
      const langs = opts.languages?.length ? opts.languages : ["English"];
      data.voices = ["male", "female"];
      data.languages = langs.map(languageRow);
    }
    if (t.kind === "quantity") {
      data.unit = "pcs";
      data.target = null;
      data.totals = { added: 0, completed: 0, declined: 0 };
    }
    if (t.kind === "printer") data.printer = null;
    return {
      id: uid(), title: t.title, hint: t.hint || "", kind: t.kind,
      status: "todo", assignees: [], dueDate: null, note: "", link: "",
      doneAt: null, doneByName: null, data,
    };
  });
}

/** How far through its language videos a languages step is. */
export function languageProgress(data: StepData) {
  const voices: ("male" | "female")[] = data.voices?.length ? data.voices : ["male", "female"];
  let total = 0;
  let done = 0;
  for (const l of data.languages || []) {
    for (const v of voices) {
      total += 2;
      if (l[v].text) done++;
      if (l[v].audio) done++;
    }
  }
  return { done, total };
}

/** Finished videos (text + audio both ticked) out of language × voice. */
export function videoProgress(data: StepData) {
  const voices: ("male" | "female")[] = data.voices?.length ? data.voices : ["male", "female"];
  let total = 0;
  let done = 0;
  for (const l of data.languages || []) {
    for (const v of voices) {
      total++;
      if (l[v].text && l[v].audio) done++;
    }
  }
  return { done, total };
}

export type CountSummary =
  | { kind: "quantity"; added: number; completed: number; declined: number; pending: number; target: number | null; unit: string }
  | { kind: "videos"; done: number; total: number; pending: number };

/** The headline number for a project list: daily-count totals or finished videos. */
export function countSummary(steps: ProjectStep[] = []): CountSummary | null {
  const q = steps.find((s) => s.kind === "quantity");
  if (q?.data?.totals) {
    const t = q.data.totals;
    // Same rule as the step's own panel: added but not yet completed or declined.
    return { kind: "quantity", ...t, pending: Math.max(0, t.added - t.completed - t.declined), target: q.data.target || null, unit: q.data.unit || "pcs" };
  }
  const l = steps.find((s) => s.kind === "languages");
  if (l?.data?.languages?.length) {
    const v = videoProgress(l.data);
    // A step ticked done counts as all videos finished (e.g. imported projects).
    const done = l.status === "done" ? v.total : v.done;
    return { kind: "videos", total: v.total, done, pending: v.total - done };
  }
  return null;
}

/**
 * The step a project is "on" for lists, the hover card and "I'm doing": the
 * most recently touched step in progress; else the latest-added / last-updated
 * open step; else (untouched template steps) the first open one.
 */
export function workingStep(steps: ProjectStep[] = []): ProjectStep | null {
  const open = steps.filter((s) => s.status !== "done");
  if (!open.length) return null;
  const touched = (s: ProjectStep) => s.updatedAt || s.createdAt || "";
  const latest = (list: ProjectStep[]) => list.reduce((a, b) => (touched(b) > touched(a) ? b : a));
  const doing = open.filter((s) => s.status === "doing");
  if (doing.length) return latest(doing);
  const dated = open.filter(touched);
  return dated.length ? latest(dated) : open[0];
}

export function projectProgress(steps: ProjectStep[] = []) {
  const total = steps.length;
  const done = steps.filter((s) => s.status === "done").length;
  const current = steps.find((s) => s.status !== "done") || null;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, current };
}

// ---- Product types ---------------------------------------------------------

export type ProductType = {
  _id: string;
  name: string;
  slug: string;
  icon: string;
  special: boolean;
  assetTab: boolean;
  assetSlots: string[];
  steps: StepTemplate[];
  checklist?: ChecklistTemplate[];
  checklistOn?: boolean;
  order: number;
};

const c = (...titles: string[]): ChecklistTemplate[] => titles.map((title) => ({ id: uid(), title }));

/** Calendar's checklist — also seeded into an existing Calendar type that has none. */
export const CALENDAR_CHECKLIST = [
  "Size confirmed", "Design confirmed", "Envelope design confirmed", "Sample created",
  "Vendor confirmed", "Production files ready", "Sent for printing",
];

const s =(title: string, kind: StepKind, hint = ""): StepTemplate => ({ id: uid(), title, kind, hint });

const VIDEO_STEPS = (makeLabel: string) => [
  s("Storyboard & script received", "check", "Collect the storyboard and script from the client."),
  s(makeLabel, "check", "Create the video from the storyboard."),
  s("Language videos", "languages", "For every language: male & female video, each with text setting and audio. No languages = English."),
  s("Client link generation", "link", "Set the final videos on the client link and paste the link here."),
  s("Tutorial video", "link", "Make the tutorial video and paste its link."),
];

/** Starting product types. Templates are only a starting point — admins can edit them on the Product Types page. */
export const DEFAULT_TYPES: Omit<ProductType, "_id" | "slug" | "order">[] = [
  {
    name: "RxPad", icon: "clipboard", special: true, assetTab: false, assetSlots: [],
    steps: [
      s("Design", "check", "Prepare and approve the RxPad design."),
      s("Daily production", "quantity", "Log each day how many RxPads were added, completed and declined."),
      s("Printing", "printer", "Choose the printer and send the files."),
      s("Delivered", "check"),
    ],
  },
  { name: "EVideo", icon: "clapperboard", special: true, assetTab: true, assetSlots: ["Cover", "Front", "Back"], steps: VIDEO_STEPS("Animation") },
  { name: "AI Video", icon: "sparkles", special: true, assetTab: true, assetSlots: ["Cover", "Front", "Back"], steps: VIDEO_STEPS("AI video generation") },
  {
    name: "Post", icon: "image", special: true, assetTab: false, assetSlots: [],
    steps: [
      s("Content received", "check"),
      s("Design", "check"),
      s("Client approval", "check"),
      s("Posted / delivered", "link", "Paste the post link if there is one."),
    ],
  },
  {
    name: "Calendar", icon: "calendar", special: true, assetTab: true, assetSlots: ["Cover", "Front", "Back"],
    steps: [
      s("Theme & content received", "check"),
      s("Design — cover, front & back", "check"),
      s("Client approval", "check"),
      s("Printing", "printer"),
      s("Delivered", "check"),
    ],
    checklist: c(...CALENDAR_CHECKLIST), checklistOn: true,
  },
  {
    name: "Frame", icon: "frame", special: true, assetTab: true, assetSlots: ["Cover", "Front", "Back"],
    steps: [
      s("Design", "check"),
      s("Client approval", "check"),
      s("Printing", "printer"),
      s("Delivered", "check"),
    ],
  },
  { name: "QR Stamp", icon: "qr", special: false, assetTab: false, assetSlots: [], steps: [] },
];
