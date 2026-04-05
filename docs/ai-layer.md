# AI Layer — Developer Reference

OkNexus includes a multi-provider AI layer that powers several features across the platform.

---

## Provider Abstraction (`lib/ai-provider.ts`)

All AI calls go through a unified `getCompletion(provider, options)` function. The system automatically checks which providers are configured and can fall back between Groq and Gemini at runtime.

| Provider | Key Required | Best For |
|---|---|---|
| Groq | `GROQ_API_KEY` | Fast inference, text actions, retest engine LLM |
| Gemini | `GEMINI_API_KEY` | Template wizard (higher token limit), cover graphic SVG |

---

## Features

### Text Refinement (`refineTextAction`)
Refines, rewrites, shortens, or expands selected text in the finding editor.

- Uses **Groq** (`llama-3.3-70b-versatile`).
- Automatically searches for **RAG context** from the current engagement's artifacts using `ScopedRetrievalService` and injects it into the prompt for grounded suggestions.

### Executive Summary (`generateClientSummaryAction`)
Generates a business-focused 3–4 sentence executive summary for a client's risk posture, given their Critical + High findings.

### Finding Explanation (`explainFindingAction`)
Explains a finding in business terms, fix terms, or answers a custom user question.

### Template Wizard (`chatTemplateWizardAction`)
A multi-turn agentic chat that progressively collects user preferences and generates a complete JSON template config.

- Supports Groq and Gemini with automatic fallback.
- Includes **6 quick-start presets** (Enterprise Formal, Startup Lean, Red Team, etc.).
- The final JSON is wrapped in `___TEMPLATE_JSON_START___` / `___TEMPLATE_JSON_END___` markers for extraction.
- Generates templates with full branding, section selection, font/color palette, findings layout, and content verbosity settings.

### Cover Graphic Generation (`generateCoverGraphicAction`)
Generates a compact SVG cover graphic using a text description.

- Preferred: **Gemini** (higher token limit for SVG).
- Fallback: **Groq**.
- Output is base64-encoded and returned as a `data:image/svg+xml;base64,...` URL.

---

## Local Semantic Search (Transformers.js)

OkNexus uses `@xenova/transformers` to run the **BAAI/bge-small-en-v1.5** embedding model directly in the Next.js server process (no external API call needed for search).

- **First run**: downloads ~33MB of ONNX model files to `.cache/transformers/`. This takes 30–60 seconds.
- **Subsequent runs**: loads from cache in <1 second.
- **Used by**: `ScopedRetrievalService` to find relevant artifact excerpts for context-aware AI suggestions.

### Troubleshooting Transformers.js

```bash
# Clear Next.js build cache
rm -rf .next && npm run dev

# Clear model cache (forces re-download)
rm -rf .cache/transformers

# Reinstall package
npm install @xenova/transformers
```

If issues persist, temporarily disable auto-embedding in `lib/storage.ts` by commenting out the embedding queue calls.

---

## Environment Variables

| Key | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | Yes | Retest engine LLM, text actions, template wizard fallback |
| `GEMINI_API_KEY` | Recommended | Template wizard (preferred), cover graphic generation |
| `NEXT_PUBLIC_AI_ENABLED` | Yes | Enables AI features in the UI (`true`/`false`) |
