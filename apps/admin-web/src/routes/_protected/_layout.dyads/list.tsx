import { createFileRoute } from "@tanstack/react-router";
import { DyadsPage } from "../../../features/dyads/DyadsPage";

export const Route = createFileRoute('/_protected/_layout/dyads/list')({
  component: DyadsPage
})   