/**
 * The closed state of the create flow's dialog (#979 B).
 *
 * A slot renders `default` when no intercepted route matches — which is every visit to
 * `/dashboard/relationships` that was not a soft navigation into a stage. It draws nothing: a
 * placeholder here would be a panel over the page that the person never asked for.
 */
export default function Default() {
  return null;
}
