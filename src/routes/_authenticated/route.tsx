// Single-user app: no auth gate. The folder name is kept for URL stability.
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  component: () => <Outlet />,
});

