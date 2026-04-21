import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, User, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/logo.png";

const privateLinks = [
  { to: "/planos" as const, label: "Dietas e Treinos" },
  { to: "/chat" as const, label: "Chat NutriAI" },
];

export function SiteHeader() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const links = user ? privateLinks : [];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-glow">
            <img src={logo} alt="NutriNow" className="h-full w-full object-cover" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Nutri<span className="text-primary">Now</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-medium text-muted-foreground transition-smooth hover:text-foreground"
              activeProps={{ className: "text-sm font-semibold text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link
                to="/perfil"
                className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium transition-smooth hover:bg-secondary/80"
              >
                <User className="h-4 w-4" /> {user.nome.split(" ")[0]}
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-secondary"
              >
                Entrar
              </Link>
              <Link
                to="/cadastro"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-smooth hover:opacity-90"
              >
                Comecar gratis
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border md:hidden"
          aria-label="Abrir menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-4">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {user ? (
                <>
                  <Link
                    to="/perfil"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
                  >
                    <User className="h-4 w-4" /> Perfil ({user.nome.split(" ")[0]})
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setOpen(false);
                    }}
                    className="rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-border px-3 py-2.5 text-center text-sm font-medium"
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/cadastro"
                    onClick={() => setOpen(false)}
                    className="rounded-xl bg-foreground px-3 py-2.5 text-center text-sm font-semibold text-background"
                  >
                    Comecar gratis
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      {children}
    </div>
  );
}
