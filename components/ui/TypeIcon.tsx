import {
  ArrowLeftRight, Award, BookOpen, Box, Brush, CalendarDays, Clapperboard, ClipboardList, FileImage, Film, Frame,
  Gamepad2, Gift, Globe, Heart, Image, Link, Mail, Megaphone, Monitor, Nfc, Package, Palette, Play, Printer,
  QrCode, Shirt, Smartphone, Sparkles, Stamp, Star, Video, type LucideIcon,
} from "lucide-react";

export const TYPE_ICONS: Record<string, LucideIcon> = {
  clipboard: ClipboardList, clapperboard: Clapperboard, sparkles: Sparkles, image: Image, calendar: CalendarDays,
  frame: Frame, qr: QrCode, box: Box, film: Film, link: Link, award: Award, monitor: Monitor, smartphone: Smartphone,
  globe: Globe, video: Video, play: Play, nfc: Nfc, gamepad: Gamepad2, mail: Mail, brush: Brush, arrows: ArrowLeftRight,
  package: Package, "file-image": FileImage, palette: Palette, printer: Printer, star: Star, heart: Heart, gift: Gift,
  megaphone: Megaphone, book: BookOpen, stamp: Stamp, shirt: Shirt,
};

const SIZES = {
  xs: "h-5 w-5 rounded [&>svg]:h-3 [&>svg]:w-3",
  sm: "h-7 w-7 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5",
  md: "h-8 w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4",
  lg: "h-10 w-10 rounded-lg [&>svg]:h-5 [&>svg]:w-5",
};

/** Product type icon — the same accent style for every type; the icon tells them apart. */
export default function TypeIcon({ icon, size = "md" }: { icon?: string; size?: keyof typeof SIZES }) {
  const Icon = TYPE_ICONS[icon || "box"] || Box;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center bg-accent-soft text-accent ${SIZES[size]}`}>
      <Icon strokeWidth={2.2} />
    </span>
  );
}

export function TypeBadge({ type }: { type?: { name: string; icon?: string } }) {
  if (!type) return null;
  const Icon = TYPE_ICONS[type.icon || "box"] || Box;
  return (
    <span className="chip max-w-full bg-panel2 text-muted">
      <Icon className="h-3 w-3 shrink-0 text-accent" strokeWidth={2.4} />
      <span className="truncate">{type.name}</span>
    </span>
  );
}
