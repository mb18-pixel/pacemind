"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Lock } from "lucide-react";

export default function AuthForm({
  title,
  subtitle,
  submitLabel,
  onSubmit,
  footerLink,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSubmit({ email, password });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-md bg-accent/10 blur-3xl" />
        <div className="absolute -left-20 bottom-1/4 h-64 w-2 rotate-12 bg-accent" />
      </div>

      <div className="animate-fade-up relative w-full max-w-md">
        <div className="card-elevated border-t-2 border-t-accent p-8">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text">
            {title}
          </h1>
          <p className="mt-2 text-sm text-text-muted">{subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                <Mail size={14} className="text-accent" />
                E-Mail
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="name@beispiel.de"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                <Lock size={14} className="text-accent" />
                Passwort
              </span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Mindestens 6 Zeichen"
              />
            </label>

            {error && (
              <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Bitte warten …" : submitLabel}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-text-muted">
            {footerLink.text}{" "}
            <Link
              href={footerLink.href}
              className="font-bold uppercase tracking-wide text-accent hover:text-accent-hover"
            >
              {footerLink.label}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
