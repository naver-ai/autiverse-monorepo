import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage } from '../../../features/data/DashboardPage'

export const Route = createFileRoute('/_protected/_layout/data/')({
  component: DashboardPage,
})