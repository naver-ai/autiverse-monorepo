import { createFileRoute } from '@tanstack/react-router'
import { DyadJournalEntriesPage } from '../../features/dyads/DyadJournalEntriesPage'

export const Route = createFileRoute('/_protected/_layout/dyads/$dyadId/journal-entries')({
  component: DyadJournalEntriesPage,
}) 