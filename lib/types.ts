import type { ProjectStep, StepTemplate } from "./workflow";

export type Me = { id: string; name: string; role: "admin" | "member"; email: string };

export type User = {
  _id: string;
  name: string;
  email: string;
  mobile?: string;
  role: "admin" | "member";
  team?: string;
  active?: boolean;
  lastLoginAt?: string;
};

export type TypeRef = { _id: string; name: string; slug: string; icon: string; special?: boolean; /** Steps grouped into modules (IT projects). */ modules?: boolean };

export type ProductTypeDoc = TypeRef & {
  special: boolean;
  assetTab: boolean;
  assetSlots: string[];
  steps: StepTemplate[];
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
  steps: ProjectStep[];
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
