import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Leaf,
  Dumbbell,
  Apple,
  MessageCircle,
  Sparkles,
  ArrowRight,
  Check,
  Camera,
  HeartPulse,
  Star,
} from "lucide-react";
import heroImg from "@/assets/hero-nutrition.jpg";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "NutriNow — Nutrição e treinos com IA para sua rotina" },
      {
        name: "description",
        content:
          "NutriNow é seu assistente de nutrição e treinos com IA. Crie planos personalizados, analise refeições por foto e converse com a NutriAI.",
      },
      { property: "og:title", content: "NutriNow — Nutrição e treinos com IA" },
      {
        property: "og:description",
        content:
          "Planos de dieta e treino personalizados, análise de refeições por foto e chat com IA.",
      },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap",
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-gradient-soft">
      <div className="absolute inset-0 bg-gradient-radial" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Powered by NutriAI
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Sua rotina saudável,{" "}
            <span className="text-gradient">guiada por IA.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Planos de dieta e treino personalizados, análise de refeições pela foto
            e um assistente que conversa com você 24/7. Tudo em um só lugar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-hero px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-elegant transition-smooth hover:-translate-y-0.5 hover:shadow-glow"
            >
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-smooth hover:border-primary/40 hover:bg-secondary"
            >
              Ver como funciona
            </a>
          </div>
          <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Sem cartão</div>
            <div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Cancela quando quiser</div>
          </div>
        </div>

        <div className="relative animate-fade-up [animation-delay:200ms]">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-hero opacity-20 blur-3xl" aria-hidden />
          <div className="relative overflow-hidden rounded-[2rem] border border-border/60 shadow-elegant">
            <img
              src={heroImg}
              alt="Smoothie verde com frutas, abacate e halteres — nutrição e treino"
              width={1280}
              height={960}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="absolute -left-4 top-8 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-3 pr-4 shadow-elegant backdrop-blur animate-float">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HeartPulse className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="text-sm font-semibold">1.840 kcal • 132g proteína</p>
            </div>
          </div>

          <div className="absolute -bottom-4 right-2 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-3 pr-4 shadow-elegant backdrop-blur animate-float [animation-delay:1.5s]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/30 text-foreground">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">NutriAI</p>
              <p className="text-sm font-semibold">Plano gerado em 12s</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Apple,
      title: "Dietas personalizadas",
      desc: "Cardápios montados pela IA com base no seu objetivo, restrições e rotina.",
    },
    {
      icon: Dumbbell,
      title: "Treinos sob medida",
      desc: "Programas semanais adaptados ao seu nível, equipamento e tempo disponível.",
    },
    {
      icon: Camera,
      title: "Análise por foto",
      desc: "Tire foto da refeição e receba estimativa de calorias e macros na hora.",
    },
    {
      icon: MessageCircle,
      title: "Chat com NutriAI",
      desc: "Tire dúvidas, ajuste planos e receba motivação a qualquer hora do dia.",
    },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          Tudo que você precisa para se sentir bem
        </h2>
        <p className="mt-4 text-muted-foreground">
          Um app completo que combina nutrição, treino e inteligência artificial
          numa experiência simples.
        </p>
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group rounded-3xl border border-border bg-card p-6 transition-smooth hover:-translate-y-1 hover:border-primary/30 hover:shadow-elegant"
          >
            <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-glow transition-smooth group-hover:scale-110">
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Crie seu perfil", desc: "Conte seus objetivos, preferências e restrições em 2 minutos." },
    { n: "02", title: "Receba seu plano", desc: "A NutriAI monta dieta e treino personalizados pra você." },
    { n: "03", title: "Acompanhe e evolua", desc: "Registre refeições, treinos e veja seu progresso em tempo real." },
  ];
  return (
    <section id="how" className="bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Como funciona</h2>
          <p className="mt-4 text-muted-foreground">
            Em três passos você já está no caminho de uma vida mais saudável.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-3xl border border-border bg-card p-8 shadow-sm">
              <span className="font-display text-5xl font-bold text-gradient">{s.n}</span>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const t = [
    { name: "Marina S.", role: "Estudante", text: "Em 3 meses mudei minha relação com comida. O chat me ajuda quando bate vontade de desistir." },
    { name: "Rafael P.", role: "Engenheiro", text: "Os treinos cabem na minha rotina caótica. E a análise por foto é mágica." },
    { name: "Carla M.", role: "Mãe e atleta", text: "Finalmente um app que entende minhas restrições. Recomendo demais!" },
  ];
  return (
    <section id="depoimentos" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold md:text-4xl">Quem usa, ama</h2>
        <p className="mt-4 text-muted-foreground">Histórias reais de quem transformou a rotina com o NutriNow.</p>
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {t.map((p) => (
          <figure key={p.name} className="rounded-3xl border border-border bg-card p-8 shadow-sm transition-smooth hover:shadow-elegant">
            <div className="flex gap-1 text-primary">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="mt-4 text-base leading-relaxed text-foreground">
              "{p.text}"
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-hero font-semibold text-primary-foreground">
                {p.name[0]}
              </span>
              <div>
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.role}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="cta" className="mx-auto max-w-6xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-hero p-10 text-primary-foreground shadow-elegant md:p-16">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">
            Comece sua jornada saudável hoje.
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/85">
            Crie sua conta grátis e tenha um plano personalizado em minutos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-2 rounded-full bg-background px-6 py-3.5 text-sm font-semibold text-foreground shadow-md transition-smooth hover:-translate-y-0.5"
            >
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-primary-foreground backdrop-blur transition-smooth hover:bg-white/20"
            >
              Saber mais
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="font-display font-semibold">NutriNow</span>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} NutriNow. Feito com cuidado para sua saúde.
        </p>
      </div>
    </footer>
  );
}
