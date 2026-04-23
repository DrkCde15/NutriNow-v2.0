import { useMemo, useState, type ReactNode } from "react";
import { Activity, Ruler, Scale } from "lucide-react";
import { Slider } from "@/components/ui/slider";

type BmiCategory = {
  label: string;
  range: string;
  color: string;
  accentClass: string;
};

const BMI_CATEGORIES: Array<{ min: number; max: number; config: BmiCategory }> = [
  {
    min: 0,
    max: 18.49,
    config: {
      label: "Abaixo do peso",
      range: "< 18.5",
      color: "#60a5fa",
      accentClass: "border-sky-500/20 bg-sky-500/10 text-sky-700",
    },
  },
  {
    min: 18.5,
    max: 24.9,
    config: {
      label: "Peso normal",
      range: "18.5 - 24.9",
      color: "#22c55e",
      accentClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    },
  },
  {
    min: 25,
    max: 29.9,
    config: {
      label: "Sobrepeso",
      range: "25 - 29.9",
      color: "#facc15",
      accentClass: "border-yellow-500/20 bg-yellow-500/10 text-yellow-700",
    },
  },
  {
    min: 30,
    max: 34.9,
    config: {
      label: "Obesidade I",
      range: "30 - 34.9",
      color: "#fb923c",
      accentClass: "border-orange-500/20 bg-orange-500/10 text-orange-700",
    },
  },
  {
    min: 35,
    max: Number.POSITIVE_INFINITY,
    config: {
      label: "Obesidade II+",
      range: "> 35",
      color: "#ef4444",
      accentClass: "border-red-500/20 bg-red-500/10 text-red-700",
    },
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBmiCategory(bmi: number) {
  return BMI_CATEGORIES.find(({ min, max }) => bmi >= min && bmi <= max)?.config ?? BMI_CATEGORIES[1].config;
}

function formatHeight(height: number) {
  return `${height.toFixed(2)} m`;
}

function formatWeight(weight: number) {
  return `${weight.toFixed(0)} kg`;
}

function BmiAvatar({ bmi, color }: { bmi: number; color: string }) {
  const normalized = clamp((bmi - 15) / 25, 0, 1);
  const shoulderScale = 0.84 + normalized * 0.46;
  const torsoScale = 0.78 + normalized * 0.7;
  const hipScale = 0.84 + normalized * 0.6;
  const legScale = 0.82 + normalized * 0.3;
  const armDistance = 17 + normalized * 7;

  return (
    <div className="relative mx-auto flex h-[25rem] w-full max-w-[18rem] items-center justify-center">
      <div
        className="absolute inset-x-8 bottom-5 h-14 rounded-full blur-2xl transition-all duration-500"
        style={{ backgroundColor: `${color}33` }}
        aria-hidden
      />

      <svg
        viewBox="0 0 220 360"
        className="h-full w-full drop-shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
        role="img"
        aria-label="Avatar corporal reagindo ao IMC"
      >
        <defs>
          <linearGradient id="avatarFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.88" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>

        <g
          style={{
            transition: "transform 360ms ease, fill 360ms ease",
            transformOrigin: "110px 90px",
          }}
        >
          <circle cx="110" cy="52" r="28" fill="url(#avatarFill)" />

          <g
            style={{
              transition: "transform 360ms ease",
              transformOrigin: "110px 118px",
              transformBox: "fill-box",
              transform: `scaleX(${shoulderScale})`,
            }}
          >
            <rect x="76" y="78" width="68" height="88" rx="34" fill="url(#avatarFill)" />
          </g>

          <g
            style={{
              transition: "transform 360ms ease",
              transformOrigin: "110px 188px",
              transformBox: "fill-box",
              transform: `scaleX(${torsoScale})`,
            }}
          >
            <path
              d="M82 140 C72 160 70 190 72 214 C74 238 84 264 110 264 C136 264 146 238 148 214 C150 190 148 160 138 140 Z"
              fill="url(#avatarFill)"
            />
          </g>

          <g
            style={{
              transition: "transform 360ms ease",
              transformOrigin: "110px 228px",
              transformBox: "fill-box",
              transform: `scaleX(${hipScale})`,
            }}
          >
            <path
              d="M76 214 C80 192 140 192 144 214 L154 264 C158 280 144 294 128 294 H92 C76 294 62 280 66 264 Z"
              fill="url(#avatarFill)"
            />
          </g>

          <g
            style={{
              transition: "transform 360ms ease",
              transformOrigin: "110px 188px",
            }}
          >
            <path
              d={`M${110 - armDistance} 116 C${92 - armDistance / 4} 146 ${94 - armDistance / 3} 174 ${88 - armDistance / 2} 210 C86 224 88 240 94 254 C98 244 100 230 104 214 C108 194 110 166 ${110 - armDistance + 6} 116 Z`}
              fill="url(#avatarFill)"
            />
            <path
              d={`M${110 + armDistance} 116 C${128 + armDistance / 4} 146 ${126 + armDistance / 3} 174 ${132 + armDistance / 2} 210 C134 224 132 240 126 254 C122 244 120 230 116 214 C112 194 110 166 ${110 + armDistance - 6} 116 Z`}
              fill="url(#avatarFill)"
            />
          </g>

          <g
            style={{
              transition: "transform 360ms ease",
              transformOrigin: "110px 312px",
              transformBox: "fill-box",
              transform: `scaleX(${legScale})`,
            }}
          >
            <path
              d="M92 284 C88 308 82 330 80 346 C80 352 84 356 90 356 H98 C104 356 108 352 108 346 C108 330 106 308 104 284 Z"
              fill="url(#avatarFill)"
            />
            <path
              d="M128 284 C132 308 138 330 140 346 C140 352 136 356 130 356 H122 C116 356 112 352 112 346 C112 330 114 308 116 284 Z"
              fill="url(#avatarFill)"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

interface BmiAvatarCalculatorProps {
  initialWeight?: number;
  initialHeight?: number;
  className?: string;
}

export function BmiAvatarCalculator({
  initialWeight = 68,
  initialHeight = 1.72,
  className,
}: BmiAvatarCalculatorProps) {
  const [weight, setWeight] = useState(initialWeight);
  const [height, setHeight] = useState(initialHeight);

  const bmi = useMemo(() => weight / (height * height), [weight, height]);
  const category = getBmiCategory(bmi);

  return (
    <section className={className ?? "mx-auto max-w-6xl px-6 py-24"}>
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-8 shadow-elegant md:px-10 md:py-12">
        <div
          className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl transition-all duration-500"
          style={{ backgroundColor: `${category.color}26` }}
          aria-hidden
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Activity className="h-3.5 w-3.5" /> Simulador de IMC
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Veja o avatar reagir ao seu IMC em tempo real
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Arraste os controles de peso e altura para calcular o IMC e observar o corpo
              estilizado mudar de forma e cor com uma transicao suave.
            </p>

            <div className="mt-8 grid gap-6">
              <SliderField
                icon={<Scale className="h-4 w-4" />}
                label="Peso"
                value={weight}
                displayValue={formatWeight(weight)}
                min={35}
                max={180}
                step={1}
                onValueChange={(next) => setWeight(next)}
              />
              <SliderField
                icon={<Ruler className="h-4 w-4" />}
                label="Altura"
                value={height}
                displayValue={formatHeight(height)}
                min={1.3}
                max={2.1}
                step={0.01}
                onValueChange={(next) => setHeight(next)}
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-full max-w-md rounded-[2rem] bg-gradient-soft p-6">
              <BmiAvatar bmi={bmi} color={category.color} />

              <div className="mt-2 text-center">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  IMC atual
                </p>
                <p className="mt-2 font-display text-5xl font-bold tracking-tight text-foreground">
                  {bmi.toFixed(1)}
                </p>
                <div
                  className={`mx-auto mt-4 inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${category.accentClass}`}
                >
                  {category.label}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                {BMI_CATEGORIES.map(({ config }) => {
                  const isActive = config.label === category.label;

                  return (
                    <div
                      key={config.label}
                      className={`rounded-2xl border px-3 py-3 text-center transition-all duration-300 ${
                        isActive ? "scale-[1.02] border-transparent shadow-md" : "border-border bg-white/70"
                      }`}
                      style={isActive ? { backgroundColor: `${config.color}20`, color: config.color } : undefined}
                    >
                      <div className="font-semibold">{config.range}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{config.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  icon: ReactNode;
  onValueChange: (value: number) => void;
}

function SliderField({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  icon,
  onValueChange,
}: SliderFieldProps) {
  return (
    <div className="rounded-3xl border border-border bg-gradient-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
            {icon}
          </span>
          {label}
        </div>
        <span className="text-sm font-semibold text-primary">{displayValue}</span>
      </div>

      <Slider
        aria-label={label}
        className="mt-5"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => {
          if (typeof next === "number") {
            onValueChange(next);
          }
        }}
      />

      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
