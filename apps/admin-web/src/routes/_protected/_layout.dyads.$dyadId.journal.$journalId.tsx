import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_protected/_layout/dyads/$dyadId/journal/$journalId',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_layout/dyads/$dyadId/journal/$journalId"!</div>
}
