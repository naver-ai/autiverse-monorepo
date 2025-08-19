import { createFileRoute } from '@tanstack/react-router'
import { DyadJournalEntryDetailPage } from '../../../../../features/dyads/DyadJournalEntryDetailPage'

export const Route = createFileRoute('/_protected/_layout/dyads/$dyadId/journal-entries/$journalEntryId')({
  component: DyadJournalEntryDetailPage,
}) 