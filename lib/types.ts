import type { ChecklistItem, ChecklistTemplate, ProjectStep, StepTemplate } from "./workflow";

export type Me = { id: string; name: string; role: "admin" | "member"; email: string };

export type User = {
  _id: string;
  name: string;
  email: string;
  mobile?: string;
  role: "admin" | "member";
  team?: string;
  /** Team lead: gets notified when their team starts or finishes work. */
  lead?: boolean;
  active?: boolean;
  lastLoginAt?: string;
};

export type TypeRef = { _id: string; name: string; slug: string; icon: string; special?: boolean; /** Steps grouped into modules (IT projects). */ modules?: boolean; checklist?: ChecklistTemplate[]; /** Checklist switched on (shown only if it also has items). */ checklistOn?: boolean };

export type ProductTypeDoc = TypeRef & {
  special: boolean;
  assetTab: boolean;
  assetSlots: string[];
  steps: StepTemplate[];
  /** Optional tick boxes every new project of this type starts with. */
  checklist?: ChecklistTemplate[];
  order: number;
  modules?: boolean;
};

export type Project = {
  _id: string;
  theme: string;
  legacyName?: string;
  deadline: string | null;
  status: "active" | "completed" | "on-hold";
  /** ★ Starred: stays at the top of project lists. */
  priority?: boolean;
  /** Samples (lib/samples.ts): not a project until converted. */
  sample?: boolean;
  sampleStatus?: import("./samples").SampleStatus;
  workers?: string[];
  workingSince?: string;
  convertedAt?: string;
  requestedAt?: string;
  notes?: string;
  /** Ids of the departments (Video, Graphic, IT…) this project belongs to — optional, any number. */
  departments?: string[];
  steps: ProjectStep[];
  /** Tick boxes copied from the product type's checklist. */
  checklist?: ChecklistItem[];
  /** IT projects: module names in display order (tasks point at them by name). */
  modules?: string[];
  type?: TypeRef;
  brand?: { _id: string; name: string };
  company?: { _id: string; name: string };
  fileCount?: number;
  cover?: { _id: string; name: string; title?: string; thumb: string; kind: string; final: boolean };
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  completedAt?: string | null;
};

/** One step with its project, from /api/steps and the dashboard ("My steps"). */
export type StepRow = {
  index?: number;
  step: ProjectStep;
  project: { _id: string; theme: string; legacyName?: string; status: Project["status"]; deadline: string | null };
  brand?: { name?: string };
  type?: TypeRef;
};

export type Department = { _id: string; name: string; order: number };

export type Brand = { _id: string; name: string; company?: { _id: string; name: string } };
export type Company = { _id: string; name: string; brands?: { _id: string; name: string }[] };

export type Printer = {
  _id: string;
  name: string;
  email_id: string;
  printerType?: string;
  pageColor?: string;
  fileType?: string;
  fileSize?: string;
  pageType?: string;
};

export type AssetFile = { slot: string; url: string; name: string; kind: "image" | "video" | "file" };
export type Asset = {
  _id: string;
  productType: string;
  title: string;
  description: string;
  tags: string[];
  files: AssetFile[];
  createdByName: string;
  createdBy: string;
  createdAt: string;
};

export type Activity = { _id: string; type: string; message: string; userName: string; project?: string | null; createdAt: string };
