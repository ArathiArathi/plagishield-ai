import { createFileRoute } from "@tanstack/react-router";
import { AuthCallbackPage } from "./auth.callback";

export const Route = createFileRoute("/auth/google/callback")({
  head: () => ({
    meta: [
      { title: "Authenticating with Google — PlagiShield AI" },
      { name: "description", content: "Completing Google authentication..." },
    ],
  }),
  component: AuthCallbackPage,
});
