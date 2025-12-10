/**
 * PostHog Event Names
 * Use these constants to ensure consistency when referencing event names
 * across the codebase or in PostHog filters/cohorts.
 * 
 * Per workspace rules: event names referenced in 2+ places should use constants.
 */
export const POSTHOG_EVENTS = {
  EXTRACT_SUBMITTED: 'extract_submitted',
  GUIDELINE_GENERATED: 'guideline_generated',
  AUDIT_VIEWED: 'audit_viewed',
  EDIT_STARTED: 'edit_started',
  EDIT_SAVED: 'edit_saved',
  EXPORT_STARTED: 'export_started',
  UPGRADE_CLICKED: 'upgrade_clicked',
  UPGRADE_SUCCEEDED: 'upgrade_succeeded',
  CHECKOUT_STARTED: 'checkout_started',
  PREVIEW_VIEWED: 'preview_viewed',
  ERROR_OCCURRED: 'error_occurred',
  EDIT_REGENERATE_CLICKED: 'edit_regenerate_clicked',
} as const


