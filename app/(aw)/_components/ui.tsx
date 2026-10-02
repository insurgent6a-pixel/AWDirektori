"use client";

// The whole UI kit. Press feedback (tap), entrances (rise) and the sheet motion come from _lib/theme.css.

import { ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn, imgUrl, initials } from "../_lib/format";

// ── Button ──────────────────────────────────────────────────────────

const BUTTON_VARIANTS = {
  primary: "bg-maroon text-white shadow-button hover:bg-maroon-dark",
  secondary: "border border-line bg-surface text-ink shadow-card hover:bg-page",
  ghost: "text-maroon hover:bg-blush",
  danger: "border border-red/25 bg-surface text-red hover:bg-red-soft",
} as const;
const BUTTON_SIZES = {
  sm: "h-10 gap-1.5 px-3.5 text-[13px] md:h-9", // 40px on phones: a thumb needs it
  md: "h-11 gap-2 px-5 text-sm",
  lg: "h-13 gap-2 px-6 text-[15px]",
} as const;

type ButtonProps = {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
  full?: boolean;
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", size = "md", loading, full, href, className, children, ...rest }: ButtonProps) {
  const classes = cn(
    "tap inline-flex shrink-0 items-center justify-center rounded-xl font-semibold whitespace-nowrap [&_svg]:shrink-0",
    "disabled:pointer-events-none disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    full && "w-full",
    className,
  );
  if (href) {
    // Outside links (WhatsApp, a business website) open in a new tab.
    return /^(https?:|mailto:|tel:)/i.test(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    ) : (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" {...rest} className={classes} disabled={loading || rest.disabled}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

// "floating" is the small round button that sits on top of an image.
export function IconButton({
  label,
  floating,
  className,
  children,
  ...rest
}: { label: string; floating?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "tap grid shrink-0 place-items-center text-ink disabled:pointer-events-none disabled:opacity-50",
        floating ? "h-10 w-10 rounded-full bg-surface/95 shadow-card hover:bg-surface" : "h-11 w-11 rounded-xl border border-line bg-surface hover:bg-page",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Memuat"
      className={cn("inline-block animate-spin rounded-full border-2 border-current border-r-transparent", className ?? "h-5 w-5")}
    />
  );
}

// ── Form fields ─────────────────────────────────────────────────────

// -outline-offset-1 puts the focus ring on the border: one ring, not a maroon border with a second ring around it.
const FIELD =
  "w-full rounded-xl border border-line bg-surface px-4 text-ellipsis text-ink placeholder:text-ink-soft focus:border-maroon focus-visible:-outline-offset-1 disabled:bg-page";

export function Field({
  label,
  optional,
  hint,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-[13px] font-medium">
        {label}
        {optional && <span className="font-normal text-ink-soft">opsional</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[13px] text-red">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-[13px] text-ink-soft">{hint}</span>
      )}
    </label>
  );
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, "h-12", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} className={cn(FIELD, "py-3 leading-relaxed", className)} {...rest} />;
}

// `compact`: the 40px size of a filter bar. Forms keep the roomier 48px.
export function Select({ className, compact, children, ...rest }: { compact?: boolean } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn("relative block", className)}>
      <select className={cn(FIELD, "appearance-none truncate hover:border-maroon/40 active:bg-page", compact ? "h-10 pr-8 pl-3" : "h-12 pr-9 pl-3.5")} {...rest}>
        {children}
      </select>
      <ChevronDown className={cn("pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft", compact ? "right-2.5" : "right-3.5")} />
    </span>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  compact,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
      <Search className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-maroon", compact ? "left-3.5 h-4 w-4" : "left-4 h-[18px] w-[18px]")} />
      <input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(FIELD, compact ? "h-10 pr-10 pl-10" : "h-12 pr-11 pl-11", "[&::-webkit-search-cancel-button]:hidden")}
      />
      {value && (
        <button
          type="button"
          aria-label="Hapus pencarian"
          onClick={() => onChange("")}
          className={cn("tap absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:bg-page", compact ? "right-0" : "right-1")}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </span>
  );
}

// A switch. The thumb springs across at the tap, before the server has answered; onChange may be async, and resolving
// to false (the change failed) puts the thumb back. The ::before widens the hit area to 64x44.
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => unknown;
  label: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState<boolean | null>(null); // shown until `checked` catches up
  const saving = useRef(false);
  useEffect(() => setPending(null), [checked]);
  const on = pending ?? checked;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={async () => {
        if (saving.current) return; // a second tap while the first is still being saved
        saving.current = true;
        setPending(!on);
        const result = await onChange(!on);
        saving.current = false;
        if (result === false) setPending(null);
      }}
      className={cn(
        "tap relative h-7 w-12 shrink-0 rounded-full before:absolute before:-inset-2 hover:opacity-90 disabled:opacity-50",
        on ? "bg-maroon" : "bg-ink-soft/75",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-transform duration-[620ms] ease-bouncy",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}

// ── Small pieces ────────────────────────────────────────────────────

const BADGE_TONES = {
  maroon: "bg-blush text-maroon",
  solid: "bg-maroon text-white",
  gold: "bg-gold-soft text-gold",
  green: "bg-green-soft text-green",
  amber: "bg-amber-soft text-amber",
  red: "bg-red-soft text-red",
  gray: "bg-sunken text-ink-soft",
} as const;
export type Tone = keyof typeof BADGE_TONES;

export function Badge({ tone = "maroon", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] leading-5 font-semibold whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Keeps the chosen item of a sideways scroller (staff tabs, queue chips) in view on a phone, without moving the page.
// Put the returned ref on the scroller; the chosen item is the one with aria-current="page" or aria-pressed="true".
// `deps`: whatever can move it. That is the choice itself, and also count badges that load late and widen the items
// in front of it.
export function useKeepInView<T extends HTMLElement>(deps: unknown[]) {
  const scroller = useRef<T>(null);
  useEffect(() => {
    const box = scroller.current;
    const chosen = box?.querySelector<HTMLElement>('[aria-current="page"], [aria-pressed="true"]');
    if (box && chosen) box.scrollLeft += chosen.getBoundingClientRect().left - box.getBoundingClientRect().left - (box.clientWidth - chosen.offsetWidth) / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return scroller;
}

// Filter chip: 32px tall. On a touch screen its ::before stretches the area a thumb can hit to 40px.
export function Chip({ active, className, children, ...rest }: { active?: boolean } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "tap relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium whitespace-nowrap disabled:opacity-60",
        "pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-1",
        active ? "border-maroon bg-maroon text-white" : "border-line bg-surface text-ink hover:border-maroon/40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// className is for layout only. There is no tailwind-merge, so it cannot override a component's own look.
export function Card({ raised, className, children, ...rest }: { raised?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface", raised ? "shadow-raised" : "shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

// Segmented control. The pill slides between equal-width tabs on a spring.
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const index = Math.max(0, items.findIndex((item) => item.value === value));
  return (
    <div
      role="tablist"
      className={cn("relative grid rounded-full bg-sunken p-1", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full bg-surface shadow-card transition-transform duration-[470ms] ease-spring"
        style={{ width: `calc((100% - 0.5rem) / ${items.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cn(
            "tap relative z-10 flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold",
            item.value === value ? "text-maroon" : "text-ink-soft hover:text-ink",
          )}
        >
          <span className="truncate">{item.label}</span>
          {!!item.count && <span className="rounded-full bg-maroon px-1.5 text-[10px] leading-4 text-white">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full bg-blush text-[13px] font-semibold text-maroon", className ?? "h-10 w-10")}
    >
      {initials(name)}
    </span>
  );
}

// A stored image with the brand treatment, or a monogram when there is none. A file that is gone from storage gets the
// monogram too, never a broken picture, and onError tells the caller. eager: loaded before it scrolls into view.
export function Media({ path, name, className, onError, eager }: { path: string | null; name: string; className?: string; onError?: () => void; eager?: boolean }) {
  const [broken, setBroken] = useState<string | null>(null); // the path that failed, so a new picture gets its chance
  return (
    <div className={cn("relative isolate overflow-hidden bg-maroon-deep", className)}>
      {path && path !== broken ? (
        <>
          <img src={imgUrl(path)} alt={name} loading={eager ? "eager" : "lazy"} onError={() => (setBroken(path), onError?.())} className="h-full w-full object-cover" />
          <span className="absolute inset-0 bg-maroon/25 mix-blend-multiply" />
          <span className="absolute inset-0 bg-linear-to-t from-black/60 via-black/5 to-transparent" />
        </>
      ) : (
        <>
          <span className="absolute inset-0 bg-[radial-gradient(90%_70%_at_85%_0%,rgb(139_26_26/0.9),transparent_70%),radial-gradient(70%_60%_at_0%_100%,rgb(138_106_47/0.35),transparent_70%)]" />
          <span className="absolute inset-0 grid place-items-center text-5xl font-semibold tracking-tight text-white/90">
            {initials(name)}
          </span>
        </>
      )}
    </div>
  );
}

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rise mx-auto flex max-w-sm flex-col items-center px-4 py-12 text-center">
      {icon && <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blush text-maroon">{icon}</span>}
      <p className="h-card">{title}</p>
      {children && <p className="body-copy mt-1.5 text-sm">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-2xl", className)} />;
}

export function Notice({ tone = "red", children }: { tone?: "red" | "amber" | "green" | "maroon"; children: React.ReactNode }) {
  const tones = {
    red: "bg-red-soft text-red",
    amber: "bg-amber-soft text-amber",
    green: "bg-green-soft text-green",
    maroon: "bg-blush text-maroon",
  };
  return (
    <p role={tone === "red" ? "alert" : undefined} className={cn("rounded-xl px-4 py-3 text-sm leading-relaxed", tones[tone])}>
      {children}
    </p>
  );
}

// Put this above a list that comes from useQuery, so a failed load never looks like an empty list.
export function Failed({ query }: { query: { error: string | null; reload: () => void } }) {
  if (!query.error) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-soft px-4 py-3 text-sm text-red">
      Data belum bisa dimuat. Periksa koneksi lalu coba lagi ya.
      <Button size="sm" variant="secondary" onClick={query.reload}>
        Coba lagi
      </Button>
    </div>
  );
}

// ── Sheet ───────────────────────────────────────────────────────────

// A native <dialog>: focus trap, Esc and the backdrop come from the browser.
// Success messages belong in a toast after closing; errors stay inline, since toasts sit under an open sheet.
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressed = useRef(false);
  // Children stay mounted while the sheet slides away, then unmount so forms start clean next time.
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      dialog.style.transform = dialog.style.transition = ""; // left behind by a drag-to-close
      setMounted(true);
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [open]);

  // Phones: the top of the sheet is a handle. Drag it down and the sheet follows the finger and closes, as in a native app.
  const drag = useRef<{ from: number; by: number } | null>(null);
  const dragStart = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button") || matchMedia("(min-width: 40rem)").matches) return;
    drag.current = { from: e.clientY, by: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const dragMove = (e: React.PointerEvent) => {
    const dialog = ref.current;
    if (!drag.current || !dialog) return;
    drag.current.by = Math.max(0, e.clientY - drag.current.from);
    dialog.style.transition = "none";
    dialog.style.transform = "translateY(" + drag.current.by + "px)";
  };
  const dragEnd = () => {
    const dialog = ref.current;
    const by = drag.current?.by;
    drag.current = null;
    if (by == null || !dialog) return;
    if (by > 80) {
      // far enough: finish the way down, then close
      dialog.style.transition = "transform 0.2s var(--ease-drawer)";
      dialog.style.transform = "translateY(100%)";
      setTimeout(onClose, 180);
    } else {
      dialog.style.transform = dialog.style.transition = ""; // back up on the stylesheet's spring
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="aw-sheet"
      // React passes "close" up the tree, so a sheet opened from inside this one would close both without the check.
      onClose={(e) => e.target === ref.current && onClose()}
      // A tap on the backdrop closes the sheet. The press must have begun there too: a text selection dragged out of a
      // field and released on the backdrop is not a tap, and closing would throw the typed text away.
      onPointerDown={(e) => (pressed.current = e.target === ref.current)}
      onClick={(e) => e.target === ref.current && pressed.current && onClose()}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="shrink-0 touch-none sm:touch-auto" onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}>
          <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 rounded-full bg-line sm:hidden" />
          <header className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
            <h2 id={titleId} className="h-card">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Tutup"
              onClick={onClose}
              className="tap -mr-2 grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-page"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          {mounted && children}
        </div>
      </div>
    </dialog>
  );
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<unknown> | void;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // This sheet stays mounted for a whole list: a failure on one item must not greet the next one.
  const close = () => {
    setError(null);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={title}>
      <p className="body-copy text-sm">{children}</p>
      {error && (
        <div className="mt-3">
          <Notice>{error}</Notice>
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={close}>
          Batal
        </Button>
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm();
            } catch (e) {
              // Shown inside the sheet: a toast would sit behind it.
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

// ── Toast ───────────────────────────────────────────────────────────

type ToastItem = { id: number; message: string; tone: "ok" | "error" };
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const emit = (next: ToastItem[]) => {
  toasts = next;
  listeners.forEach((listener) => listener());
};

export function toast(message: string, tone: ToastItem["tone"] = "ok") {
  const id = Date.now() + Math.random();
  emit([...toasts.slice(-2), { id, message, tone }]);
  setTimeout(() => emit(toasts.filter((item) => item.id !== id)), 3400);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const noToasts: ToastItem[] = [];

export function Toaster() {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => noToasts,
  );
  return (
    // pointer-events-none, the messages too: a toast has nothing to press, and for its few seconds it must not swallow
    // a tap meant for the button underneath.
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-8"
    >
      {items.map((item) => (
        <p
          key={item.id}
          className={cn(
            "animate-toast max-w-sm rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-float",
            item.tone === "error" ? "bg-red" : "bg-ink",
          )}
        >
          {item.message}
        </p>
      ))}
    </div>
  );
}
