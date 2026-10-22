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

export type TypeRef = { _id: string; name: string; slug: string; icon: string; special?: boolean };

export type ProductTypeDoc = TypeRef & {
  special: boolean;
  assetTab: boolean;
  assetSlots: string[];
  steps: StepTemplate[];
  order: number;
};

export type Project = {
  _id: string;
  theme: string;
  legacyName?: string;
  deadline: string | null;
  status: "active" | "completed" | "on-hold";
  notes?: string;
  steps: ProjectStep[];
  type?: TypeRef;
  brand?: { _id: string; name: string };
  company?: { _id: string; name: string };
  openTasks?: number;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  completedAt?: string | null;
};

export type Task = {
  _id: string;
  title: string;
  status: "open" | "done";
  assignees: string[];
  dueDate: string | null;
  project?: { _id: string; theme?: string } | string | null;
  brandName?: string;
  typeName?: string;
  typeIcon?: string;
  createdByName?: string;
  createdAt: string;
  doneAt?: string | null;
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
