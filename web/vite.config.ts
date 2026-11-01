import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

/**
 * The admin panel, built as a single-page app and embedded in the Go binary.
 *
 * Preact rather than React: through preact/compat the component code is
 * identical, and the runtime is 10 KB against React 19's 98 KB. The panel is
 * behind a login and loaded once per session, so that saving matters less here
 * than it would on the public pages — but it is free, and nothing in this app
 * needs React internals.
 *
 * @preact/preset-vite installs the compat aliases, so `react` and `react-dom`
 * resolve to Preact for react-router and TanStack Query alike.
 */
export default defineConfig({
  plugins: [preact(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // The Go server reads this to find the hashed asset names, so the public
    // templates can link the same stylesheet the admin app loads.
    manifest: true,
    // The Go server serves these from the embedded filesystem at /assets/.
    assetsDir: "assets",
  },
  server: {
    port: 5173,
    // In development the API runs separately; proxying it keeps the browser on
    // one origin, so the session cookie behaves exactly as it will in
    // production rather than being a third-party cookie the browser drops.
    proxy: {
      "/v1": { target: "http://127.0.0.1:8099", changeOrigin: false },
    },
  },
});
