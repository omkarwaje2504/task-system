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

export type ProjectStep = StepTemplate & {
  status: StepStatus;
  assignee: string | null;
  note: string;
  link: string;
  doneAt: string | null;
  doneByName: string | null;
  data: StepData;
};

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
      status: "todo", assignee: null, note: "", link: "",
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
  order: number;
};

const s = (title: string, kind: StepKind, hint = ""): StepTemplate => ({ id: uid(), title, kind, hint });

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
