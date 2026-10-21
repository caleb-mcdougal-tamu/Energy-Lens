import React from "react";
import { Settings } from "lucide-react";

// Shown when the deployment has no Google OAuth client ID configured.
export default function SetupRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700 mb-3">
          <Settings className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-semibold text-neutral-900">Google sign-in isn&rsquo;t configured</h1>
        <p className="mt-2 text-sm text-neutral-600">
          This deployment is missing the <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code>{" "}
          environment variable. Create a Google OAuth client ID (see the README&rsquo;s setup
          section), add it to <code className="font-mono">.env.local</code> for local development
          or to your Vercel project&rsquo;s Environment Variables, then rebuild.
        </p>
      </div>
    </div>
  );
}
