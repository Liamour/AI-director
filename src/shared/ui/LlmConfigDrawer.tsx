// ──────────────────────────────────────────────────────────────────────────
// LlmConfigDrawer — global LLM config access from any page's header.
//
// Renders a small "config" button. Clicking opens a slide-in drawer with
// preset chips (deepseek / doubao / gemini / gpt-4o), base url, model id,
// and api key inputs. Reads/writes via useScriptStore so the config
// persists across pages and sessions.
//
// Use it in the chassis header next to the runtime badge:
//
//     <LlmConfigDrawer />
//
// Stage 0/1 pages need this because they call the LLM directly. Without
// this drawer the user has no way to set credentials except by visiting
// /agent-lab — bad UX for the project creation flow.
// ──────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useScriptStore } from '@/store/scriptStore';
import { Key, Panel, Divider } from './te';

interface PresetEntry {
  label: string;
  baseUrl: string;
  modelId: string;
}

// Same list as agent-lab — kept duplicated for now; will be extracted to
// a shared `presets.ts` once we have a third consumer.
const PRESETS: readonly PresetEntry[] = [
  { label: 'deepseek', baseUrl: 'https://api.deepseek.com/v1/chat/completions', modelId: 'deepseek-chat' },
  { label: 'doubao',   baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', modelId: 'doubao-pro-32k' },
  { label: 'gemini',   baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', modelId: 'gemini-2.0-flash' },
  { label: 'gpt-4o',   baseUrl: 'https://api.openai.com/v1/chat/completions', modelId: 'gpt-4o' },
] as const;

export function LlmConfigDrawer() {
  const { apiKey, baseUrl, customModelId, setApiConfig } = useScriptStore();
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const activePreset = PRESETS.findIndex(
    (p) => p.baseUrl === baseUrl && p.modelId === customModelId
  );
  const apiReady = !!apiKey && !!baseUrl && !!customModelId;

  const applyPreset = (i: number) => {
    const p = PRESETS[i];
    setApiConfig({ baseUrl: p.baseUrl, customModelId: p.modelId });
  };

  return (
    <>
      {/* trigger — TE key affordance + literal brackets so it reads as
          a clickable control, not just header text */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="llm backbone config"
        className="flex items-center gap-1.5 h-8 px-3 rounded-md
          bg-te-bone-dim text-te-charcoal/80 shadow-te-key
          hover:bg-te-bone-deep hover:text-te-charcoal
          active:translate-y-[1px] active:shadow-te-key-active
          text-[12px] font-te-mono uppercase tracking-[0.18em] transition-colors"
      >
        <span className="text-te-charcoal/40 leading-none">[</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            apiReady
              ? 'bg-te-ok shadow-[0_0_4px_rgba(127,176,105,0.8)]'
              : 'bg-te-warn shadow-[0_0_4px_rgba(252,191,73,0.8)]'
          }`}
        />
        <span>config</span>
        <span className="text-te-charcoal/40 leading-none">]</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-te-charcoal/55 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[440px] h-full overflow-y-auto p-5 bg-te-bone"
            >
              <Panel title="llm backbone · config" meta="openai-compatible">
                <div className="flex flex-col gap-4">
                  {/* preset row */}
                  <div>
                    <label className="block text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mb-2">
                      preset{' '}
                      {activePreset === -1 && (
                        <span className="text-te-charcoal/35 normal-case tracking-normal">
                          · custom
                        </span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS.map((p, i) => (
                        <Key
                          key={p.label}
                          variant="text"
                          active={i === activePreset}
                          onClick={() => applyPreset(i)}
                        >
                          {p.label}
                        </Key>
                      ))}
                    </div>
                  </div>

                  {/* base url */}
                  <div>
                    <label className="block text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mb-2">
                      base url
                    </label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setApiConfig({ baseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                      spellCheck={false}
                      autoComplete="off"
                      className="te-input"
                    />
                    <div className="text-[11px] font-te-mono lowercase tracking-[0.12em] text-te-charcoal/40 mt-1.5">
                      sdk base (…/v1) or full path (…/v1/chat/completions)
                    </div>
                  </div>

                  {/* model id */}
                  <div>
                    <label className="block text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mb-2">
                      model id <span className="text-te-charcoal/35 normal-case tracking-normal">· chat</span>
                    </label>
                    <input
                      type="text"
                      value={customModelId}
                      onChange={(e) => setApiConfig({ customModelId: e.target.value })}
                      placeholder="gpt-4o"
                      spellCheck={false}
                      autoComplete="off"
                      className="te-input"
                    />
                  </div>

                  {/* api key */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55">
                        api key
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="text-[11px] font-te-mono lowercase tracking-[0.12em] text-te-charcoal/45 hover:text-te-charcoal transition-colors"
                      >
                        {showKey ? 'hide' : 'show'}
                      </button>
                    </div>
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiConfig({ apiKey: e.target.value })}
                      placeholder="sk-…"
                      spellCheck={false}
                      autoComplete="off"
                      className="te-input"
                    />
                    <div className="text-[11px] font-te-mono lowercase tracking-[0.12em] text-te-charcoal/40 mt-1.5">
                      stored in localStorage on this machine — never sent anywhere except the base url above.
                    </div>
                  </div>

                  <Divider className="my-1" />

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-te-mono uppercase tracking-[0.18em] ${
                        apiReady ? 'text-te-ok' : 'text-te-warn'
                      }`}
                    >
                      {apiReady ? '✓ ready' : '! incomplete'}
                    </span>
                    <Key variant="wide" active onClick={() => setOpen(false)}>
                      done
                    </Key>
                  </div>
                </div>
              </Panel>

              <p className="mt-4 text-[11px] font-te-mono lowercase tracking-[0.12em] text-te-charcoal/40 text-center">
                press esc to close
              </p>

              {/* local te-input styles — same as landing/stage1 */}
              <style jsx>{`
                :global(.te-input) {
                  width: 100%;
                  background: #1f2418;
                  color: #b8c77a;
                  font-family: 'JetBrains Mono', ui-monospace, monospace;
                  font-size: 13px;
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
                  box-shadow: 0 0 0 1px rgba(184, 199, 122, 0.5) inset,
                    0 0 12px rgba(0, 0, 0, 0.5) inset;
                }
              `}</style>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
