"use client"

import * as React from "react"
import { useState } from "react"
import { ArrowLeft, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { AuditPreset } from "@/types/fortress"

// Must match VALID_READABILITY in lib/brand-voice-constants.ts
const READABILITY_LEVELS = [
  { value: "grade_6_8", label: "Grade 6-8" },
  { value: "grade_10_12", label: "Grade 10-12" },
  { value: "grade_13_plus", label: "13+" },
] as const

const FORMALITY_LEVELS = [
  { value: "casual", label: "Casual" },
  { value: "neutral", label: "Neutral" },
  { value: "formal", label: "Formal" },
] as const

/** Options sent to the API when using custom preset */
export interface CustomAuditOptions {
  flagAiWriting?: boolean
  readabilityLevel?: string
  formality?: string
  locale?: string
  includeLongform?: boolean
  voiceSummary?: string
}

interface AuditIntentPickerProps {
  isAuthenticated: boolean
  /** User's plan - controls which options are available */
  plan?: 'free' | 'pro' | 'enterprise'
  onSelect: (preset: AuditPreset, options?: CustomAuditOptions) => void
  onBack?: () => void
  /** Domain being audited, shown in heading context */
  domain?: string
  /** Compact mode for use inside dialogs */
  compact?: boolean
  /**
   * Pre-populate toggles from saved audit settings.
   * When provided, the picker uses these values as initial state instead of
   * the "full audit" hardcoded defaults. Undefined fields fall back to defaults.
   */
  defaultOptions?: CustomAuditOptions
}

// Reusable pill selector for picking one value from a short list
function PillSelect({ options, value, onChange }: {
  options: ReadonlyArray<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5 animate-in fade-in duration-150">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border transition-colors",
            value === opt.value
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Small lock + "Pro" badge for gated features
function ProBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
      <Lock className="h-2.5 w-2.5" />
      Pro
    </span>
  )
}

export function AuditIntentPicker({
  isAuthenticated,
  plan = 'free',
  onSelect,
  onBack,
  domain,
  compact = false,
  defaultOptions,
}: AuditIntentPickerProps) {
  const isPaid = plan === 'pro' || plan === 'enterprise'

  // If saved settings were passed in, use them; otherwise fall back to "full audit" defaults.
  // The dialog renders this component only after settings are loaded, so initial values are stable.
  const hasSaved = defaultOptions !== undefined

  const [flagAiWriting, setFlagAiWriting] = useState(defaultOptions?.flagAiWriting ?? true)
  // Readability: on by default unless saved settings say off (no readabilityLevel saved)
  const [readabilityEnabled, setReadabilityEnabled] = useState(hasSaved ? !!defaultOptions?.readabilityLevel : true)
  const [readabilityLevel, setReadabilityLevel] = useState(defaultOptions?.readabilityLevel ?? "grade_10_12")
  const [formalityEnabled, setFormalityEnabled] = useState(hasSaved ? !!defaultOptions?.formality : false)
  const [formality, setFormality] = useState(defaultOptions?.formality ?? "neutral")
  // Locale: off by default unless saved settings specify a variant
  const [localeEnabled, setLocaleEnabled] = useState(hasSaved ? !!defaultOptions?.locale : false)
  const [locale, setLocale] = useState<"en-GB" | "en-US">((defaultOptions?.locale as "en-GB" | "en-US") ?? "en-GB")
  const [includeLongform, setIncludeLongform] = useState(defaultOptions?.includeLongform ?? false)
  const [brandVoiceEnabled, setBrandVoiceEnabled] = useState(false)
  const [voiceSummary, setVoiceSummary] = useState("")

  const handleSubmit = () => {
    // Always submit as "custom" — the toggles define what gets checked
    onSelect("custom", {
      flagAiWriting,
      readabilityLevel: readabilityEnabled ? readabilityLevel : undefined,
      formality: formalityEnabled ? formality : undefined,
      // localeEnabled=false means "off" — model infers language from the site
      locale: localeEnabled ? locale : undefined,
      includeLongform: isPaid ? includeLongform : false,
      voiceSummary: isPaid && brandVoiceEnabled && voiceSummary.trim() ? voiceSummary.trim() : undefined,
    })
  }

  return (
    <div className={cn(
      "w-full",
      compact ? "space-y-4" : "space-y-6 max-w-xl mx-auto"
    )}>
      {/* Header */}
      <div className={compact ? "" : "text-center"}>
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        <h2 className={cn(
          "font-serif font-light tracking-tight",
          compact ? "text-xl mb-1" : "text-3xl md:text-4xl mb-3"
        )}>
          Audit settings
        </h2>
        {domain && !compact && (
          <p className="text-muted-foreground text-sm">{domain}</p>
        )}
      </div>

      {/* Audit settings — all options as toggles */}
      <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border/60 text-left">

        {/* AI pattern detection */}
        <label htmlFor="flag-ai-writing" className="flex items-center justify-between px-4 py-3 cursor-pointer">
          <div className="pr-4">
            <span className="text-sm font-medium block">AI pattern detection</span>
            <span className="text-xs text-muted-foreground">Flag AI-generated text patterns</span>
          </div>
          <Switch
            id="flag-ai-writing"
            checked={flagAiWriting}
            onCheckedChange={setFlagAiWriting}
          />
        </label>

        {/* Readability */}
        <div className="px-4 py-3">
          <label htmlFor="readability-check" className="flex items-center justify-between cursor-pointer">
            <div className="pr-4">
              <span className="text-sm font-medium block">Readability</span>
              <span className="text-xs text-muted-foreground">Flag pages above a target reading level</span>
            </div>
            <Switch
              id="readability-check"
              checked={readabilityEnabled}
              onCheckedChange={setReadabilityEnabled}
            />
          </label>
          {readabilityEnabled && (
            <PillSelect
              options={READABILITY_LEVELS}
              value={readabilityLevel}
              onChange={setReadabilityLevel}
            />
          )}
        </div>

        {/* English variant */}
        <div className="px-4 py-3">
          <label htmlFor="locale-check" className="flex items-center justify-between cursor-pointer">
            <div className="pr-4">
              <span className="text-sm font-medium block">English variant</span>
              <span className="text-xs text-muted-foreground">
                {localeEnabled ? "Flag spelling that doesn't match the chosen variant" : "Off - model infers from site content"}
              </span>
            </div>
            <Switch
              id="locale-check"
              checked={localeEnabled}
              onCheckedChange={setLocaleEnabled}
            />
          </label>
          {localeEnabled && (
            <PillSelect
              options={[
                { value: "en-GB", label: "British" },
                { value: "en-US", label: "American" },
              ]}
              value={locale}
              onChange={(v) => setLocale(v as "en-GB" | "en-US")}
            />
          )}
        </div>

        {/* Formality — Pro only */}
        <div className="px-4 py-3">
          <label htmlFor="formality-check" className={cn(
            "flex items-center justify-between",
            isPaid ? "cursor-pointer" : "cursor-not-allowed"
          )}>
            <div className="pr-4">
              <span className="text-sm font-medium flex items-center gap-1.5">
                Formality
                {!isPaid && <ProBadge />}
              </span>
              <span className="text-xs text-muted-foreground">
                Flag content that doesn't match your tone
              </span>
            </div>
            <Switch
              id="formality-check"
              checked={formalityEnabled}
              onCheckedChange={isPaid ? setFormalityEnabled : undefined}
              disabled={!isPaid}
            />
          </label>
          {formalityEnabled && isPaid && (
            <PillSelect
              options={FORMALITY_LEVELS}
              value={formality}
              onChange={setFormality}
            />
          )}
        </div>

        {/* Include blog/longform — Pro only */}
        <label
          htmlFor="include-longform"
          className={cn(
            "flex items-center justify-between px-4 py-3",
            isPaid ? "cursor-pointer" : "cursor-not-allowed"
          )}
        >
          <div className="pr-4">
            <span className="text-sm font-medium flex items-center gap-1.5">
              Include blog/articles
              {!isPaid && <ProBadge />}
            </span>
            <span className="text-xs text-muted-foreground">
              Audit blog and article pages too
            </span>
          </div>
          <Switch
            id="include-longform"
            checked={includeLongform}
            onCheckedChange={isPaid ? setIncludeLongform : undefined}
            disabled={!isPaid}
          />
        </label>

        {/* Brand voice — Pro only */}
        <div className="px-4 py-3">
          <label htmlFor="brand-voice-check" className={cn(
            "flex items-center justify-between",
            isPaid ? "cursor-pointer" : "cursor-not-allowed"
          )}>
            <div className="pr-4">
              <span className="text-sm font-medium flex items-center gap-1.5">
                Brand voice
                {!isPaid && <ProBadge />}
              </span>
              <span className="text-xs text-muted-foreground">
                Audit against your writing style
              </span>
            </div>
            <Switch
              id="brand-voice-check"
              checked={brandVoiceEnabled}
              onCheckedChange={isPaid ? setBrandVoiceEnabled : undefined}
              disabled={!isPaid}
            />
          </label>
          {brandVoiceEnabled && isPaid && (
            <div className="mt-2.5 animate-in fade-in duration-150">
              <Textarea
                placeholder="Describe your brand voice - e.g. 'Friendly and direct. Short sentences. Avoid jargon. Never use exclamation marks.'"
                value={voiceSummary}
                onChange={(e) => setVoiceSummary(e.target.value)}
                rows={3}
                className="text-sm resize-none"
                maxLength={2000}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                The auditor will flag content that doesn't match this voice
              </p>
            </div>
          )}
        </div>

        {/* Link to saved settings for authenticated users */}
        {isAuthenticated && (
          <div className="px-4 py-3">
            <a
              href="/dashboard/audit-options"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Keyword rules, saved settings &rarr;
            </a>
          </div>
        )}
      </div>

      {/* Submit button */}
      <Button
        size="lg"
        className={cn(
          "font-medium",
          compact ? "w-full h-11" : "w-full h-14 text-lg"
        )}
        onClick={handleSubmit}
      >
        Run audit
      </Button>
    </div>
  )
}
