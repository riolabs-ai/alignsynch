// template-ancestor: components/ui/card.tsx   (variation: a named placeholder card — the section, the persona, and one line of what will live there, until the owning card fills it)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERSONA_META, type Persona } from "@/data/v1/fixtures";

/**
 * The stub every not-yet-built `/v1/[persona]/…` section renders. It is a real page, not a 404
 * and not a dead link: the section name, the persona, and one line of what will live there
 * (`SECTION_SUMMARIES`). The five fill-in cards replace this card's contents on their own route,
 * so the stub is deliberately the thinnest surface that still proves the route is wired.
 *
 * `persona` is the `[persona]` param the page already validated against the matrix, so the stub
 * itself does not re-decide it — the `notFound()` gate lives in the page.
 */
export function SectionStub({
  section,
  persona,
  summary,
  detail,
}: {
  section: string;
  persona: Persona;
  summary: string;
  /** Extra context for a dynamic route (e.g. the relationship or thread id). */
  detail?: string;
}) {
  const meta = PERSONA_META[persona];
  const fullName = meta.surname ? `${meta.name} ${meta.surname}` : meta.name;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{section}</CardTitle>
          <CardDescription>
            {meta.label}
            {fullName !== meta.label ? ` · ${fullName}` : ""}
            {detail !== undefined ? ` · ${detail}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </CardContent>
      </Card>
    </div>
  );
}
