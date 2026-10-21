import React from "react";
import { Camera, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import GoogleIcon from "@/components/GoogleIcon";

export default function SignIn() {
  const { login, ready, authError, lastEmail } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm text-center">
        <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-neutral-900 text-white mb-4">
          <Camera className="h-7 w-7" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Energy Lens</h1>
        <p className="text-neutral-500 mt-2 mb-8">
          Organize field photos by site and equipment. Your photos are stored in your own Google
          Drive.
        </p>

        <button
          onClick={login}
          disabled={!ready}
          className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-neutral-200 bg-white text-neutral-900 font-medium shadow-sm hover:bg-neutral-50 disabled:opacity-60"
        >
          <GoogleIcon />
          {lastEmail ? `Continue as ${lastEmail}` : "Sign in with Google"}
        </button>

        {authError && (
          <p className="mt-4 flex items-start justify-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {authError}
          </p>
        )}

        <p className="mt-8 text-xs text-neutral-400">
          Energy Lens asks for Google Drive access so it can create an &ldquo;Energy Lens&rdquo;
          folder, save photos into it, and open assessment folders teammates share with you.
        </p>
      </div>
    </div>
  );
}
