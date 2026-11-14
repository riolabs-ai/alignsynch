/**
 * The create flow's stage 4, Account, intercepted over `/dashboard/relationships` (#979 B).
 *
 * **The stage is not re-implemented here.** This file is the mounting and nothing else: it renders
 * `TemplateCreateCommitPage` — the route a deep link, a refresh and an invitation link all land on — with
 * `mount="dialog"`, and `RelationshipFlowShell` decides that the frame is drawn over the page
 * underneath instead of on a page of its own. One stage component, two mountings, so the dialog
 * cannot drift from the page it claims to be.
 *
 * **The address stays the stage's own.** Interception masks nothing: the URL after this render is
 * `/templates/relationship/<slug>/create/commit` exactly. A refresh of it renders the same stage as a page, which is the deep-link parity
 * the card requires, and the reason the flow advances with the addresses `lib/flow/paths.ts`
 * already builds rather than with a dialog of its own.
 *
 * **Why the props are forwarded, not rebuilt.** `params` and `searchParams` are the target route's
 * own arguments, including the refusal codes (`?problem=&field=`) a refused post answers with. A
 * second parser here would be a second reading of the same address.
 */
import type { ComponentProps } from "react";
import TemplateCreateCommitPage from "@/app/(mainlayout)/templates/relationship/[slug]/create/commit/page";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateCommitPage>) {
  return <TemplateCreateCommitPage {...props} mount="dialog" />;
}
