"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Loader2, X, Check } from "lucide-react"
import { VALID_READABILITY, VALID_FORMALITY, VALID_LOCALE } from "@/lib/brand-voice-constants"

interface ContentCheckSettings {
  readability_level: string | null
  formality: string | null
  locale: string | null
  flag_keywords: string[] | null
  ignore_keywords: string[] | null
  flag_ai_writing: boolean
}

export default function ContentChecksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const domain = searchParams.get("domain")?.trim() || null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  const [readabilityLevel, setReadabilityLevel] = useState<string>("")
  const [formality, setFormality] = useState<string>("")
  const [locale, setLocale] = useState<string>("")
  const [flagKeywords, setFlagKeywords] = useState<string[]>([])
  const [ignoreKeywords, setIgnoreKeywords] = useState<string[]>([])
  const [flagKeywordsEnabled, setFlagKeywordsEnabled] = useState(false)
  const [ignoreKeywordsEnabled, setIgnoreKeywordsEnabled] = useState(false)
  const [flagKeywordInput, setFlagKeywordInput] = useState("")
  const [ignoreKeywordInput, setIgnoreKeywordInput] = useState("")
  const [flagAiWriting, setFlagAiWriting] = useState(false)

  const loadSettings = useCallback(async (token: string) => {
    if (!domain) return
    const res = await fetch(`/api/brand-voice?domain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      if (res.status === 401) router.replace("/auth/sign-in")
      return
    }
    const data = await res.json()
    if (data) {
      setReadabilityLevel(data.readability_level ?? "")
      setFormality(data.formality ?? "")
      setLocale(data.locale ?? "")
      const fk = Array.isArray(data.flag_keywords) ? data.flag_keywords : []
      const ik = Array.isArray(data.ignore_keywords) ? data.ignore_keywords : []
      setFlagKeywords(fk)
      setIgnoreKeywords(ik)
      setFlagKeywordsEnabled(fk.length > 0)
      setIgnoreKeywordsEnabled(ik.length > 0)
      setFlagAiWriting(data.flag_ai_writing === true)
    }
  }, [domain, router])

  useEffect(() => {
    if (!domain) {
      router.replace("/dashboard")
      return
    }
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace("/auth/sign-in")
        return
      }
      setAuthToken(session.access_token)
      setLoading(true)
      await loadSettings(session.access_token)
      setLoading(false)
    }
    init()
  }, [domain, router, loadSettings])

  const autoSave = useCallback(async (data: {
    readability: string | null
    formality: string | null
    locale: string | null
    flagKeywords: string[]
    ignoreKeywords: string[]
    flagAiWriting: boolean
  }) => {
    if (!authToken || !domain) return
    setSaving(true)
    try {
      // Get current profile to preserve other fields
      const getRes = await fetch(`/api/brand-voice?domain=${encodeURIComponent(domain)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const currentData = getRes.ok ? await getRes.json() : {}

      const res = await fetch("/api/brand-voice", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          domain,
          enabled: currentData.enabled ?? false,
          readability_level: data.readability,
          formality: data.formality,
          locale: data.locale,
          flag_keywords: data.flagKeywords,
          ignore_keywords: data.ignoreKeywords,
          flag_ai_writing: data.flagAiWriting,
          // Preserve other fields
          source: currentData.source ?? "manual",
          voice_summary: currentData.voice_summary ?? null,
          include_longform_full_audit: currentData.include_longform_full_audit ?? false,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: "Save failed", description: err.error || "Could not save.", variant: "destructive" })
        return
      }
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [authToken, domain, toast])

  // Auto-save when main settings change
  useEffect(() => {
    if (loading) return
    if (saveTimeout) clearTimeout(saveTimeout)
    const timeout = setTimeout(() => {
      autoSave({
        readability: readabilityLevel || null,
        formality: formality || null,
        locale: locale || null,
        flagKeywords: flagKeywordsEnabled ? flagKeywords : [],
        ignoreKeywords: ignoreKeywordsEnabled ? ignoreKeywords : [],
        flagAiWriting: flagAiWriting,
      })
    }, 500)
    setSaveTimeout(timeout)
    return () => clearTimeout(timeout)
  }, [readabilityLevel, formality, locale, flagKeywords, ignoreKeywords, flagKeywordsEnabled, ignoreKeywordsEnabled, flagAiWriting, loading, autoSave])

  if (!domain) return null
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const addFlagKeyword = () => {
    const v = flagKeywordInput.trim()
    // Validate: no newlines, no whitespace-only, length limit
    if (v && v.length <= 100 && !v.includes('\n') && !/^\s+$/.test(v)) {
      setFlagKeywords((prev) => [...prev, v])
      setFlagKeywordInput("")
    }
  }
  const addIgnoreKeyword = () => {
    const v = ignoreKeywordInput.trim()
    // Validate: no newlines, no whitespace-only, length limit
    if (v && v.length <= 100 && !v.includes('\n') && !/^\s+$/.test(v)) {
      setIgnoreKeywords((prev) => [...prev, v])
      setIgnoreKeywordInput("")
    }
  }
  const removeFlagKeyword = (i: number) => setFlagKeywords((prev) => prev.filter((_, j) => j !== i))
  const removeIgnoreKeyword = (i: number) => setIgnoreKeywords((prev) => prev.filter((_, j) => j !== i))

  return (
    <div className="container mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Content Checks</h1>
        <p className="text-muted-foreground mt-2">{domain}</p>
        <p className="text-sm text-muted-foreground mt-1">Configure what to check during audits</p>
      </div>

      <div className="space-y-12">
        {/* Writing Standards */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-4">Writing Standards</h2>
          <p className="text-sm text-muted-foreground mb-6">Always checked during audits</p>

          <div className="flex flex-wrap gap-4">
            <div className="min-w-0 flex-1 space-y-2 sm:min-w-[140px]">
              <Label htmlFor="readability">Readability</Label>
              <Select value={readabilityLevel || "none"} onValueChange={(v) => setReadabilityLevel(v === "none" ? "" : v)}>
                <SelectTrigger id="readability">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value={VALID_READABILITY[0]}>Grade 6–8</SelectItem>
                  <SelectItem value={VALID_READABILITY[1]}>Grade 10–12</SelectItem>
                  <SelectItem value={VALID_READABILITY[2]}>13+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1 space-y-2 sm:min-w-[140px]">
              <Label htmlFor="formality">Formality</Label>
              <Select value={formality || "none"} onValueChange={(v) => setFormality(v === "none" ? "" : v)}>
                <SelectTrigger id="formality">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value={VALID_FORMALITY[0]}>Very casual</SelectItem>
                  <SelectItem value={VALID_FORMALITY[1]}>Casual</SelectItem>
                  <SelectItem value={VALID_FORMALITY[2]}>Neutral</SelectItem>
                  <SelectItem value={VALID_FORMALITY[3]}>Formal</SelectItem>
                  <SelectItem value={VALID_FORMALITY[4]}>Very formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1 space-y-2 sm:min-w-[140px]">
              <Label htmlFor="locale">English variant</Label>
              <Select value={locale || "none"} onValueChange={(v) => setLocale(v === "none" ? "" : v)}>
                <SelectTrigger id="locale">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value={VALID_LOCALE[0]}>US English</SelectItem>
                  <SelectItem value={VALID_LOCALE[1]}>UK English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Keyword Rules */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-4">Keyword Rules</h2>
          <p className="text-sm text-muted-foreground mb-6">Flag specific terms in content</p>

          <div className="space-y-6">
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="flag_keywords_toggle" className="cursor-pointer font-medium">Flag keywords</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">Terms to call out (e.g. old product names, banned phrases)</p>
                </div>
                <Switch id="flag_keywords_toggle" checked={flagKeywordsEnabled} onCheckedChange={setFlagKeywordsEnabled} />
              </div>
              {flagKeywordsEnabled && (
                <div className="mt-4 space-y-3">
                  {flagKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {flagKeywords.map((k, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          {k}
                          <button type="button" onClick={() => removeFlagKeyword(i)} className="rounded-full hover:bg-muted-foreground/20 p-0.5" aria-label={`Remove ${k}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="flag_keywords_input"
                      placeholder="Add term"
                      value={flagKeywordInput}
                      onChange={(e) => setFlagKeywordInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFlagKeyword())}
                      maxLength={100}
                      className="max-w-[200px]"
                    />
                    <Button type="button" variant="secondary" size="sm" onClick={addFlagKeyword}>Add</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="ignore_keywords_toggle" className="cursor-pointer font-medium">Ignore keywords</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">Terms to allow (e.g. known variants, recognised misnomers)</p>
                </div>
                <Switch id="ignore_keywords_toggle" checked={ignoreKeywordsEnabled} onCheckedChange={setIgnoreKeywordsEnabled} />
              </div>
              {ignoreKeywordsEnabled && (
                <div className="mt-4 space-y-3">
                  {ignoreKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {ignoreKeywords.map((k, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          {k}
                          <button type="button" onClick={() => removeIgnoreKeyword(i)} className="rounded-full hover:bg-muted-foreground/20 p-0.5" aria-label={`Remove ${k}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="ignore_keywords_input"
                      placeholder="Add term"
                      value={ignoreKeywordInput}
                      onChange={(e) => setIgnoreKeywordInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addIgnoreKeyword())}
                      maxLength={100}
                      className="max-w-[200px]"
                    />
                    <Button type="button" variant="secondary" size="sm" onClick={addIgnoreKeyword}>Add</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* AI Writing Detection */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-4">AI Writing Detection</h2>
          <p className="text-sm text-muted-foreground mb-6">Flag likely AI-generated content</p>

          <div className="flex items-center justify-between rounded-md border border-border p-4">
            <div>
              <Label htmlFor="flag_ai_writing" className="cursor-pointer font-medium">Flag AI patterns</Label>
              <p className="text-sm text-muted-foreground mt-1">Flags when multiple AI writing patterns appear together</p>
            </div>
            <Switch id="flag_ai_writing" checked={flagAiWriting} onCheckedChange={setFlagAiWriting} />
          </div>
        </section>

        {saving && (
          <div className="pt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
        {justSaved && !saving && (
          <div className="pt-4 flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Saved
          </div>
        )}
      </div>
    </div>
  )
}
