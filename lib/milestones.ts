/**
 * Milestone Celebrations Utility
 *
 * Functions for detecting and managing health score milestone celebrations.
 */

export const MILESTONES = [75, 85, 95] as const
export type Milestone = typeof MILESTONES[number]

/**
 * Detects which milestones were crossed between two health scores
 * Only detects upward crossings (previousScore < milestone <= currentScore)
 *
 * @param previousScore - The previous health score
 * @param currentScore - The current health score
 * @param celebratedMilestones - Array of milestones that have already been celebrated
 * @returns Array of milestone values that should be celebrated
 */
export function detectMilestoneCrossings(
  previousScore: number | null,
  currentScore: number,
  celebratedMilestones: number[] = []
): number[] {
  // Validate inputs
  if (currentScore < 0 || currentScore > 100) {
    console.warn('[Milestones] Invalid currentScore:', currentScore)
    return []
  }

  // If no previous score, use 0 as baseline (first audit)
  const prev = previousScore ?? 0

  if (prev < 0 || prev > 100) {
    console.warn('[Milestones] Invalid previousScore:', previousScore)
    return []
  }

  // Find milestones that were crossed upward and haven't been celebrated
  const crossedMilestones = MILESTONES.filter(milestone => {
    const wasCrossed = prev < milestone && currentScore >= milestone
    const notYetCelebrated = !celebratedMilestones.includes(milestone)
    return wasCrossed && notYetCelebrated
  })

  return crossedMilestones
}

/**
 * Gets the next milestone for a given score
 * Returns null if score is already at or above the highest milestone
 */
export function getNextMilestone(score: number): number | null {
  const next = MILESTONES.find(m => score < m)
  return next ?? null
}

/**
 * Formats a milestone for display
 */
export function formatMilestone(milestone: number): string {
  return `${milestone}%`
}

/**
 * Gets the celebration toast content for a milestone
 */
export function getMilestoneToastContent(milestone: number) {
  return {
    title: `Milestone reached: ${formatMilestone(milestone)}`,
    description: "Content health improving"
  }
}
