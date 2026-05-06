// ──────────────────────────────────────────────────────────────────────────
// Landing / entry hub — TE-language device front panel.
//
// Two device-card buttons (create / open), and a creation modal with four
// project-meta fields. Style follows DESIGN_LANGUAGE.md (bone-white chassis,
// inset key shadows, lowercase labels, 4px colored dot accents).
// ──────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useScriptStore } from "@/store/scriptStore";
import { useProjectStore } from "@/store/projectStore";
import {
  isTauriEnv,
  pickAndLoadProject,
  scaffoldProject,
} from "@/shared/lib/tauri-fs";
import { Key, Panel, Divider } from "@/shared/ui/te";
import {
  ASPECT_RATIO_OPTIONS,
  FORMAT_OPTIONS,
  STYLE_OPTIONS,
  createDefaultProjectMeta,
  type AspectRatio,
  type ArtStylePreset,
  type ProjectFormat,
  type ProjectMeta,
} from "@/core/types/project";

type ModalKind = "create" | null;

const DEFAULT_FORMAT: ProjectFormat = "series";
const DEFAULT_ASPECT: AspectRatio = "16:9";
const DEFAULT_STYLE: ArtStylePreset = "photoreal";

export default function EntryHub() {
  const router = useRouter();
  const { setProjectContext } = useScriptStore();
  const {
    setProject,
    meta: persistedMeta,
    rootPath: persistedRoot,
  } = useProjectStore();

  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openHint, setOpenHint] = useState<string | null>(null);

  // Detect runtime once on mount — drives the small mode badge in the header
  // and shapes the "create" UX (real picker vs mock path).
  const [tauri, setTauri] = useState(false);
  useEffect(() => {
    setTauri(isTauriEnv());
  }, []);

  // Project creation form
  const [projectName, setProjectName] = useState("");
  const [format, setFormat] = useState<ProjectFormat>(DEFAULT_FORMAT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(DEFAULT_ASPECT);
  const [stylePreset, setStylePreset] = useState<ArtStylePreset>(DEFAULT_STYLE);

  const openCreateModal = () => {
    setModalKind("create");
    setProjectName("");
    setFormat(DEFAULT_FORMAT);
    setAspectRatio(DEFAULT_ASPECT);
    setStylePreset(DEFAULT_STYLE);
    setOpenHint(null);
  };

  const handleConfirmCreate = async () => {
    if (!projectName.trim()) return;
    try {
      setIsLoading(true);

      const meta: ProjectMeta = {
        ...createDefaultProjectMeta(projectName.trim()),
        format,
        aspectRatio,
        style: { preset: stylePreset, refImages: [] },
      };

      // Tauri: native picker → mkdir → write project.json. Web: mock path.
      const projectPath = await scaffoldProject(meta);

      setProject(meta, projectPath);
      setProjectContext(projectName.trim(), projectPath); // legacy compat

      router.push("/workspace");
    } catch (error) {
      console.error("Project initialization failed:", error);
    } finally {
      setIsLoading(false);
      setModalKind(null);
    }
  };

  /** Pop the directory picker, load project.json, hydrate stores, navigate. */
  const handleOpenProject = async () => {
    setOpenHint(null);
    try {
      setIsLoading(true);
      const result = await pickAndLoadProject();
      switch (result.kind) {
        case "ok":
          setProject(result.meta, result.rootPath);
          setProjectContext(result.meta.name, result.rootPath);
          router.push("/workspace");
          return;
        case "canceled":
          return;
        case "web-mock":
          if (persistedMeta && persistedRoot) {
            setProjectContext(persistedMeta.name, persistedRoot);
            router.push("/workspace");
            return;
          }
          setOpenHint(
            "web preview cannot reach the local filesystem. launch the desktop build (npm run tauri dev) to open a real project, or create a new one first."
          );
          return;
        case "no-meta":
          setOpenHint(
            `no project.json found in:\n${result.rootPath}\nthis folder doesn't look like an ai-director project.`
          );
          return;
        case "error":
          setOpenHint(`open failed · ${result.message}`);
          return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-te-bone font-te text-te-charcoal">
      {/* ── chassis header ────────────────────────────────────────────── */}
      <header className="px-8 pt-6 pb-4 flex items-end justify-between border-b border-te-bone-edge/40">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-te-knob-orange shadow-[0_0_4px_rgba(232,134,42,0.8)]" />
          <h1 className="text-[18px] font-semibold lowercase tracking-tight">
            ai director · entry
          </h1>
          <span className="text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/45">
            project hub
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55">
          <span>
            runtime ·{" "}
            <span className={tauri ? "text-te-ok" : "text-te-charcoal/40"}>
              {tauri ? "tauri desktop" : "web preview"}
            </span>
          </span>
          <span className="text-te-charcoal/30">v0.2</span>
        </div>
      </header>

      {/* ── hero panel ────────────────────────────────────────────────── */}
      <section className="px-8 py-12 max-w-[1100px] mx-auto">
        <div className="mb-10">
          <p className="text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/45 mb-2">
            stage 0 · project
          </p>
          <h2 className="text-[28px] font-semibold lowercase tracking-tight leading-[1.1]">
            spin up a new storyboard,
            <br />
            <span className="text-te-charcoal/55">or pick up where you left off.</span>
          </h2>
        </div>

        {/* ── two device cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <DeviceCard
            accent="orange"
            label="create"
            title="new project"
            blurb="lock format · aspect · style — scaffolds a folder on disk."
            disabled={isLoading}
            onClick={openCreateModal}
          />
          <DeviceCard
            accent="blue"
            label="open"
            title="existing project"
            blurb={
              tauri
                ? "pick a folder — auto-reads project.json."
                : "web preview restores the last persisted project."
            }
            disabled={isLoading}
            onClick={handleOpenProject}
            footer={
              persistedMeta ? (
                <span className="text-[9px] font-te-mono lowercase tracking-[0.12em] text-te-charcoal/50">
                  last opened · {persistedMeta.name}
                </span>
              ) : null
            }
          />
        </div>

        {/* hint banner */}
        {openHint && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 max-w-[720px] mx-auto px-4 py-3 rounded-md bg-te-knob-blue/10 border border-te-knob-blue/30 text-[11px] font-te-mono lowercase leading-relaxed text-te-charcoal/80 whitespace-pre-line"
          >
            {openHint}
          </motion.div>
        )}

        <Divider className="mt-12 mb-6" />
        <p className="text-[9px] font-te-mono lowercase tracking-[0.18em] text-te-charcoal/40 text-center">
          stage 0 → stage 1 story → stage 1.5 bible → stage 2 keyframes → stage 3 motion
        </p>
      </section>

      {/* ── creation modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalKind && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-te-charcoal/60 backdrop-blur-[2px]"
            onClick={() => !isLoading && setModalKind(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[640px] max-h-[92vh] overflow-hidden flex flex-col"
            >
              <Panel
                title="new project · stage 0"
                meta="lock-on-create"
                className="flex flex-col overflow-hidden"
              >
                {/* form */}
                <div className="flex flex-col gap-5 overflow-y-auto pr-1 max-h-[60vh]">
                  {/* runtime hint banner — only matters when web previewing */}
                  {!tauri && (
                    <div className="px-3 py-2 rounded-md bg-te-warn/15 border border-te-warn/40 text-[10px] font-te-mono lowercase leading-relaxed text-te-charcoal/75">
                      web preview · no native folder picker. project will use a
                      mock path. launch <span className="font-semibold">npm run tauri dev</span>{" "}
                      to scaffold real folders.
                    </div>
                  )}

                  {/* project name */}
                  <FormField label="project name" hint="lowercase, hyphens ok — also used as folder name">
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="my-cyberpunk-pilot"
                      autoFocus
                      disabled={isLoading}
                      className="te-input"
                    />
                  </FormField>

                  {/* format */}
                  <FormField label="format" accent="orange" hint="affects script length and episode breakdown">
                    <KeyRow
                      options={FORMAT_OPTIONS}
                      value={format}
                      onChange={(v) => setFormat(v)}
                      disabled={isLoading}
                    />
                  </FormField>

                  {/* aspect ratio */}
                  <FormField label="aspect ratio" accent="blue" hint="all keyframes & video clips lock to this">
                    <KeyRow
                      options={ASPECT_RATIO_OPTIONS}
                      value={aspectRatio}
                      onChange={(v) => setAspectRatio(v)}
                      disabled={isLoading}
                    />
                  </FormField>

                  {/* art style */}
                  <FormField label="art style" hint="injected into every t2i prompt — refine in stage 1.5">
                    <KeyRow
                      options={STYLE_OPTIONS}
                      value={stylePreset}
                      onChange={(v) => setStylePreset(v)}
                      disabled={isLoading}
                    />
                  </FormField>
                </div>

                {/* footer */}
                <div className="mt-5 pt-4 border-t border-te-bone-edge/40 flex items-center justify-between gap-3">
                  <span className="text-[9px] font-te-mono lowercase tracking-[0.12em] text-te-charcoal/40">
                    {tauri ? "next: pick parent folder" : "next: mock scaffold"}
                  </span>
                  <div className="flex gap-2">
                    <Key
                      variant="wide"
                      onClick={() => setModalKind(null)}
                      disabled={isLoading}
                    >
                      cancel
                    </Key>
                    <Key
                      variant="wide"
                      active
                      onClick={handleConfirmCreate}
                      disabled={isLoading || !projectName.trim()}
                    >
                      {isLoading ? "scaffolding…" : "create"}
                    </Key>
                  </div>
                </div>
              </Panel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* local utility classes — borrowed from agent-lab so the modal input
          matches the rest of the app without adding to globals.css */}
      <style jsx>{`
        :global(.te-input) {
          width: 100%;
          background: #1f2418;
          color: #b8c77a;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 12px;
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid rgba(0, 0, 0, 0.3);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4) inset, 0 0 12px rgba(0, 0, 0, 0.5) inset;
          letter-spacing: 0.02em;
          outline: none;
        }
        :global(.te-input::placeholder) {
          color: #7a8a4a;
        }
        :global(.te-input:focus) {
          box-shadow: 0 0 0 1px rgba(184, 199, 122, 0.5) inset, 0 0 12px rgba(0, 0, 0, 0.5) inset;
        }
      `}</style>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Local presentational components — kept inline to avoid scope creep into
// shared/ui until we have at least one more page that needs them.
// ──────────────────────────────────────────────────────────────────────────

interface DeviceCardProps {
  accent: "orange" | "blue";
  label: string;
  title: string;
  blurb: string;
  disabled?: boolean;
  onClick: () => void;
  footer?: React.ReactNode;
}

function DeviceCard({
  accent,
  label,
  title,
  blurb,
  disabled,
  onClick,
  footer,
}: DeviceCardProps) {
  const accentClass =
    accent === "orange"
      ? "bg-te-knob-orange shadow-[0_0_4px_rgba(232,134,42,0.8)]"
      : "bg-te-knob-blue shadow-[0_0_4px_rgba(45,91,168,0.8)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative text-left rounded-xl px-7 py-8 transition-[transform,box-shadow,background] duration-100
        bg-te-bone-dim shadow-te-panel hover:bg-te-bone-deep
        active:translate-y-[1px] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.18)]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0`}
    >
      {/* category dot + label */}
      <div className="flex items-center gap-2 mb-6">
        <span className={`w-1.5 h-1.5 rounded-full ${accentClass}`} />
        <span className="text-[9px] font-te-mono uppercase tracking-[0.22em] text-te-charcoal/55">
          {label}
        </span>
      </div>

      <h3 className="text-[22px] font-semibold lowercase tracking-tight leading-tight mb-3">
        {title}
      </h3>
      <p className="text-[11px] font-te-mono lowercase leading-relaxed text-te-charcoal/65 max-w-[28ch]">
        {blurb}
      </p>

      {footer && <div className="mt-6">{footer}</div>}

      {/* hover indicator on right side */}
      <span className="absolute top-7 right-7 text-[10px] font-te-mono lowercase tracking-[0.18em] text-te-charcoal/30 group-hover:text-te-charcoal/60 transition-colors">
        ↵
      </span>
    </button>
  );
}

interface FormFieldProps {
  label: string;
  hint?: string;
  accent?: "orange" | "blue" | "red";
  children: React.ReactNode;
}

function FormField({ label, hint, accent, children }: FormFieldProps) {
  const accentClass =
    accent === "orange"
      ? "bg-te-knob-orange"
      : accent === "blue"
      ? "bg-te-knob-blue"
      : accent === "red"
      ? "bg-te-knob-red"
      : "";

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {accent && <span className={`w-1.5 h-1.5 rounded-full ${accentClass}`} />}
        <label className="text-[9px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55">
          {label}
        </label>
      </div>
      {children}
      {hint && (
        <div className="text-[9px] font-te-mono lowercase tracking-[0.12em] text-te-charcoal/40 mt-1.5">
          {hint}
        </div>
      )}
    </div>
  );
}

interface KeyRowProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}

function KeyRow<T extends string>({ options, value, onChange, disabled }: KeyRowProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <Key
          key={opt.value}
          variant="text"
          active={value === opt.value}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label.toLowerCase()}
        </Key>
      ))}
    </div>
  );
}
