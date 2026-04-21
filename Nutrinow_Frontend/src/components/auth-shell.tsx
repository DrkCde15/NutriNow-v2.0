import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-nutrition.jpg";
import logo from "@/assets/logo.png";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-glow">
                <img src={logo} alt="NutriNow" className="h-full w-full object-cover" />
              </span>
              <span className="font-display text-xl font-bold tracking-tight">
                Nutri<span className="text-primary">Now</span>
              </span>
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
            <p className="mt-3 text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>

        <div className="relative hidden overflow-hidden bg-gradient-hero lg:block">
          <div className="absolute inset-0 bg-gradient-radial opacity-60" aria-hidden />
          <img
            src={heroImg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-overlay"
          />
          <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
            <blockquote className="max-w-md font-display text-2xl font-semibold leading-snug">
              "Mudei minha rotina em semanas. O NutriNow virou meu coach pessoal de bolso."
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-semibold">
                M
              </span>
              <div>
                <p className="text-sm font-semibold">Marina S.</p>
                <p className="text-xs text-primary-foreground/70">Estudante</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}

export function Field({ label, icon, children, hint }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <div className={icon ? "[&>input]:pl-11" : undefined}>{children}</div>
      </div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground outline-none transition-smooth placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

export const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-smooth hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
