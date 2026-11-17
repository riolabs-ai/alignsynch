"use client";

// template-ancestor: components/ui/dropdown-menu.tsx   (variation: the kebab a record card carries — the primitive's trigger, content and items with a per-row write attached, a neutral confirmation for the rows that need one, and the toast that follows a write's answer)

/**
 * The card's kebab — one control, two shelves, every row decided elsewhere (#1134).
 *
 * **The list is not this file's.** `lib/member/card-menu.ts` decides which rows a card offers (a
 * Library template, a My Template, a relationship in each of its four states) and every word they
 * print arrives as a prop, resolved by the route's own fixture. This component owns the mechanics
 * only: the `dropdown-menu` primitive, the neutral `alert-dialog` a destructive row opens, the
 * pending state, and the toast that reports the answer.
 *
 * **A write is a `"use server"` action handed in as a prop.** Nothing is imported from an actions
 * module here, so this file stays out of the client graph's server boundary (E34) and the same
 * component serves `/dashboard/templates` and `/dashboard/relationships` without either page's
 * database layer being pulled into the other's bundle.
 *
 * **The confirmation is the bundle's one neutral modal**, not a browser `confirm()`: a title, the
 * consequence in a sentence, the destructive verb as the action and the safe verb as the cancel
 * (`proto.js` pass 10 — `Cancel This Invite? · Cancel Invite · Keep Invite`). Its words are fixture
 * copy like every other string on the screen.
 *
 * **`Save a Copy` lands on the copy.** The write answers with the new row's id, and the menu pushes
 * to `?tab=mine&new=<id>` — the address the bundle's own toast links to. A `Duplicate` stays put and
 * refreshes, because the card it made is beside the one that made it.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  CardMenuEntry,
  CardMenuIcon,
  CardMenuWrite,
  CardMenuWriteId,
} from "@/lib/member/card-menu";
import { fillLabel } from "@/lib/page-copy";
import {
  Archive,
  Copy,
  CreditCard,
  Eye,
  Files,
  Mail,
  MoreHorizontal,
  PenLine,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/** The glyph per row kind. Structure, not copy: the mapping is a table, so a row cannot invent one. */
const ICONS = {
  open: Eye,
  create: UserPlus,
  save: Copy,
  edit: PenLine,
  duplicate: Files,
  archive: Archive,
  resend: Mail,
  cancel: X,
  leave: X,
  card: CreditCard,
} as const satisfies Record<CardMenuIcon, unknown>;

const TRIGGER =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
const ITEM = "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground";

/** Everything the menu needs to act, all resolved by the route that mounts the card. */
export interface CardMenuData {
  /** `More actions for {title}` — the trigger's accessible name, filled by the caller. */
  readonly label: string;
  readonly entries: readonly CardMenuEntry[];
  /** The card's own ids, handed to whichever write a row performs. */
  readonly payload: Readonly<Record<string, string | undefined>>;
  /** The card's title — the `{title}` in a notice or a confirmation. */
  readonly title: string;
  /** The `{name}` in `Leave This Relationship?` — the other party, or the fixture's word for them. */
  readonly otherParty?: string;
  readonly notices: Readonly<Partial<Record<CardMenuWriteId, string>>>;
  readonly refusals: readonly { readonly code: string; readonly label: string }[];
  readonly fallbackRefusal: string;
  readonly writes: Readonly<Partial<Record<CardMenuWriteId, CardMenuWrite>>>;
  /** Where a copy lands: the base of `?tab=mine&new=`, appended with the new row's id. */
  readonly landNewAt?: string;
}

export function CardMenu({ data }: { data: CardMenuData }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<CardMenuEntry | null>(null);
  const [pending, startTransition] = useTransition();

  /* A kebab with no rows is not a control: rule 7 omits the region rather than drawing an empty menu. */

  /** The refusal sentence for a code, or the route's fallback word. */
  const refusalFor = (code: string | undefined): string =>
    data.refusals.find((row) => row.code === code)?.label ?? data.fallbackRefusal;

  /** One write. The payload is the card's ids and nothing typed on the page. */
  function run(entry: CardMenuEntry): void {
    const id = entry.write;
    if (id === undefined) return;
    const write = data.writes[id];
    if (write === undefined) return;
    startTransition(async () => {
      const answer = await write(data.payload);
      if (!answer.ok) {
        toast(refusalFor(answer.code));
        return;
      }
      const notice = data.notices[id];
      if (notice !== undefined) {
        toast(
          fillLabel(notice, {
            title: data.title,
            name: data.otherParty ?? data.title,
            email: answer.email ?? "",
          }),
        );
      }
      if (id === "save-copy" && data.landNewAt !== undefined && answer.id !== undefined) {
        router.push(`${data.landNewAt}${encodeURIComponent(answer.id)}`);
        return;
      }
      router.refresh();
    });
  }

  return data.entries.length > 0 ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={TRIGGER}
          aria-label={data.label}
          data-card-menu-trigger="true"
          disabled={pending}
        >
          <MoreHorizontal className="size-4 shrink-0" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={data.label} data-card-menu>
        {data.entries.map((entry) => {
          const Icon = ICONS[entry.icon];
          if (entry.href !== undefined) {
            return (
              <DropdownMenuItem key={entry.id} asChild data-card-menu-item={entry.id}>
                <Link href={entry.href} className={ITEM}>
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>{entry.label}</span>
                </Link>
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem
              key={entry.id}
              data-card-menu-item={entry.id}
              className={ITEM}
              disabled={
                pending || entry.write === undefined || data.writes[entry.write] === undefined
              }
              onSelect={() => {
                if (entry.confirm === undefined) run(entry);
                else setConfirming(entry);
              }}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{entry.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
      {confirming === null ? null : (
        <AlertDialog open onOpenChange={(open) => (open ? undefined : setConfirming(null))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {fillLabel(confirming.confirm?.title ?? "", {
                  title: data.title,
                  name: data.otherParty ?? data.title,
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {fillLabel(confirming.confirm?.body ?? "", {
                  title: data.title,
                  name: data.otherParty ?? data.title,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{confirming.confirm?.cancel}</AlertDialogCancel>
              <AlertDialogAction
                data-card-menu-confirm={confirming.id}
                onClick={() => {
                  const entry = confirming;
                  setConfirming(null);
                  run(entry);
                }}
              >
                <X className="size-4 shrink-0" aria-hidden="true" />
                {confirming.confirm?.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </DropdownMenu>
  ) : null;
}
