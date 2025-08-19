import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/_layout/dyads/$dyadId/")({
  beforeLoad: async () => {
    throw redirect({ to: "/dyads/$dyadId/journal-entries/" });
  },
});
