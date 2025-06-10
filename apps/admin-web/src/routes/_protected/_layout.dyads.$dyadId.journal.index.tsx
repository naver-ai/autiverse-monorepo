import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/_layout/dyads/$dyadId/journal/')({
  beforeLoad: async ({params}) => {
    throw redirect({ to: '/dyads/$dyadId/journal/list'})
  },
})
