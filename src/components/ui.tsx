import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { forwardRef } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  Info,
  ShieldCheck,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/** Small class joiner kept local so the UI primitives stay dependency-light. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const BUTTON_VARIANTS = {
  primary:
    "bg-blue-700 text-white shadow-sm hover:bg-blue-800 focus-visible:ring-blue-600",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-blue-600",
  subtle:
    "border border-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-blue-600",
  success:
    "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 focus-visible:ring-emerald-600",
  warning:
    "bg-amber-500 text-slate-950 shadow-sm hover:bg-amber-600 focus-visible:ring-amber-500",
  danger:
    "bg-red-700 text-white shadow-sm hover:bg-red-800 focus-visible:ring-red-600",
  dark: "bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-700",
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}>(function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        size === "sm" && "min-h-10 px-3 text-xs",
        size === "lg" && "min-h-12 px-5 text-base",
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
});

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      {...props}
      className={cn(
        "ops-surface rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-5 sm:p-6", className)} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...props}
      className={cn("text-base font-semibold tracking-tight text-slate-950", className)}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn("text-sm leading-6 text-slate-600", className)} />;
}

const BADGE_TONES = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
} as const;

type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  className,
  tone = "neutral",
  icon: Icon,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
}) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        BADGE_TONES[tone],
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" size={13} strokeWidth={2.2} /> : null}
      <span>{children}</span>
    </span>
  );
}

type StatusKind =
  | "INTAKE"
  | "REVIEW"
  | "ACTIVE"
  | "CLOSED"
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "AI"
  | "HUMAN"
  | "PENDING"
  | "ANCHORED"
  | "FAILED"
  | "VERIFIED"
  | "NOT_ANCHORED"
  | "NOT_FOUND"
  | string;

const STATUS_META: Record<
  string,
  { label: string; tone: BadgeTone; icon: LucideIcon }
> = {
  INTAKE: { label: "Intake", tone: "warning", icon: Clock3 },
  REVIEW: { label: "Review", tone: "info", icon: Info },
  ACTIVE: { label: "Active", tone: "success", icon: CircleDot },
  CLOSED: { label: "Closed", tone: "neutral", icon: CheckCircle2 },
  CRITICAL: { label: "Critical", tone: "danger", icon: AlertCircle },
  HIGH: { label: "High", tone: "warning", icon: AlertCircle },
  MEDIUM: { label: "Medium", tone: "warning", icon: CircleDot },
  LOW: { label: "Low", tone: "neutral", icon: CircleDot },
  AI: { label: "AI", tone: "info", icon: Bot },
  HUMAN: { label: "Human", tone: "success", icon: UserRound },
  PENDING: { label: "Pending", tone: "warning", icon: Clock3 },
  ANCHORED: { label: "Anchored", tone: "success", icon: ShieldCheck },
  FAILED: { label: "Failed", tone: "danger", icon: XCircle },
  VERIFIED: { label: "Verified", tone: "success", icon: ShieldCheck },
  NOT_ANCHORED: { label: "Not anchored", tone: "warning", icon: Clock3 },
  NOT_FOUND: { label: "Not found", tone: "danger", icon: XCircle },
};

export function StatusBadge({
  status,
  className,
}: {
  status: StatusKind;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? {
    label: status.replaceAll("_", " "),
    tone: "neutral" as BadgeTone,
    icon: CircleDot,
  };
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={className}>
      {meta.label}
    </Badge>
  );
}

export function Alert({
  children,
  className,
  tone = "info",
  role = "status",
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
  role?: "alert" | "status";
}) {
  const icons: Record<BadgeTone, LucideIcon> = {
    neutral: Info,
    info: Info,
    success: CheckCircle2,
    warning: AlertCircle,
    danger: XCircle,
  };
  const Icon = icons[tone];
  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6",
        BADGE_TONES[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-1 shrink-0" size={16} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none", className)}
    />
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "info",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: BadgeTone;
}) {
  const iconTone = {
    neutral: "bg-slate-100 text-slate-700",
    info: "bg-blue-100 text-blue-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconTone)}>
          <Icon aria-hidden="true" size={19} />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
    </Card>
  );
}

export function FieldLabel({
  children,
  htmlFor,
  optional,
}: {
  children: ReactNode;
  htmlFor: string;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">
      {children}
      {optional ? <span className="ml-1 font-normal text-slate-500">(optional)</span> : null}
    </label>
  );
}
