import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/_layout/dyads/')({
  beforeLoad: async () => {
    throw redirect({ to: '/dyads/list' })
  }
})
