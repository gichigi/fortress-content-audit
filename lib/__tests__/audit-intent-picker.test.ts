/**
 * Tests for AuditIntentPicker logic (Cluster C: unified toggle view)
 */

// Mirror the submit logic from AuditIntentPicker
interface PickerState {
  flagAiWriting: boolean
  readabilityEnabled: boolean
  readabilityLevel: string
  formalityEnabled: boolean
  formality: string
  localeEnabled: boolean
  locale: string
  includeLongform: boolean
  brandVoiceEnabled: boolean
  voiceSummary: string
}

function buildOptions(state: PickerState, isPaid: boolean) {
  return {
    flagAiWriting: state.flagAiWriting,
    readabilityLevel: state.readabilityEnabled ? state.readabilityLevel : undefined,
    formality: state.formalityEnabled ? state.formality : undefined,
    locale: state.localeEnabled ? state.locale : undefined,
    includeLongform: isPaid ? state.includeLongform : false,
    voiceSummary: isPaid && state.brandVoiceEnabled && state.voiceSummary.trim() ? state.voiceSummary.trim() : undefined,
  }
}

const defaults: PickerState = {
  flagAiWriting: true,
  readabilityEnabled: true,
  readabilityLevel: "grade_10_12",
  formalityEnabled: false,
  formality: "neutral",
  localeEnabled: false,
  locale: "en-GB",
  includeLongform: false,
  brandVoiceEnabled: false,
  voiceSummary: "",
}

describe('AuditIntentPicker option building', () => {
  it('defaults match full audit configuration', () => {
    const opts = buildOptions(defaults, false)
    expect(opts.flagAiWriting).toBe(true)
    expect(opts.readabilityLevel).toBe("grade_10_12")
    expect(opts.formality).toBeUndefined()
    expect(opts.locale).toBeUndefined() // off = model infers
  })

  it('locale is omitted when localeEnabled is false', () => {
    const opts = buildOptions({ ...defaults, localeEnabled: false }, false)
    expect(opts.locale).toBeUndefined()
  })

  it('locale is included when localeEnabled is true', () => {
    const opts = buildOptions({ ...defaults, localeEnabled: true, locale: "en-US" }, false)
    expect(opts.locale).toBe("en-US")
  })

  it('readabilityLevel is omitted when readability is off', () => {
    const opts = buildOptions({ ...defaults, readabilityEnabled: false }, false)
    expect(opts.readabilityLevel).toBeUndefined()
  })

  it('pro features are blocked for free users', () => {
    const state: PickerState = { ...defaults, includeLongform: true, brandVoiceEnabled: true, voiceSummary: "friendly" }
    const opts = buildOptions(state, false)
    expect(opts.includeLongform).toBe(false)
    expect(opts.voiceSummary).toBeUndefined()
  })

  it('pro features are allowed for paid users', () => {
    const state: PickerState = { ...defaults, includeLongform: true, brandVoiceEnabled: true, voiceSummary: "friendly" }
    const opts = buildOptions(state, true)
    expect(opts.includeLongform).toBe(true)
    expect(opts.voiceSummary).toBe("friendly")
  })
})
