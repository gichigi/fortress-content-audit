/**
 * Tests for milestone detection logic
 */

import { detectMilestoneCrossings, getNextMilestone, formatMilestone, getMilestoneToastContent } from '../milestones'

describe('detectMilestoneCrossings', () => {
  it('detects crossing from 60 to 80 (crosses 75)', () => {
    const crossings = detectMilestoneCrossings(60, 80, [])
    expect(crossings).toEqual([75])
  })

  it('detects crossing from 60 to 90 (crosses 75 and 85)', () => {
    const crossings = detectMilestoneCrossings(60, 90, [])
    expect(crossings).toEqual([75, 85])
  })

  it('detects crossing from 70 to 100 (crosses all milestones)', () => {
    const crossings = detectMilestoneCrossings(70, 100, [])
    expect(crossings).toEqual([75, 85, 95])
  })

  it('does not detect crossing when score stays below milestone', () => {
    const crossings = detectMilestoneCrossings(60, 70, [])
    expect(crossings).toEqual([])
  })

  it('does not detect crossing when score stays above milestone', () => {
    const crossings = detectMilestoneCrossings(80, 90, [])
    expect(crossings).toEqual([85])
  })

  it('does not celebrate already celebrated milestones', () => {
    const crossings = detectMilestoneCrossings(60, 80, [75])
    expect(crossings).toEqual([])
  })

  it('only celebrates new milestones, not already celebrated ones', () => {
    const crossings = detectMilestoneCrossings(60, 90, [75])
    expect(crossings).toEqual([85])
  })

  it('handles null previous score as 0', () => {
    const crossings = detectMilestoneCrossings(null, 80, [])
    expect(crossings).toEqual([75])
  })

  it('handles first audit with high score', () => {
    const crossings = detectMilestoneCrossings(null, 95, [])
    expect(crossings).toEqual([75, 85, 95])
  })

  it('does not celebrate when crossing milestone downward', () => {
    const crossings = detectMilestoneCrossings(80, 70, [])
    expect(crossings).toEqual([])
  })

  it('celebrates re-crossing milestone if not already celebrated', () => {
    const crossings = detectMilestoneCrossings(70, 80, [])
    expect(crossings).toEqual([75])
  })

  it('handles invalid scores gracefully', () => {
    const crossings1 = detectMilestoneCrossings(60, 150, [])
    expect(crossings1).toEqual([])

    const crossings2 = detectMilestoneCrossings(-10, 80, [])
    expect(crossings2).toEqual([])
  })
})

describe('getNextMilestone', () => {
  it('returns 75 for scores below 75', () => {
    expect(getNextMilestone(60)).toBe(75)
    expect(getNextMilestone(74)).toBe(75)
  })

  it('returns 85 for scores between 75 and 85', () => {
    expect(getNextMilestone(75)).toBe(85)
    expect(getNextMilestone(80)).toBe(85)
    expect(getNextMilestone(84)).toBe(85)
  })

  it('returns 95 for scores between 85 and 95', () => {
    expect(getNextMilestone(85)).toBe(95)
    expect(getNextMilestone(90)).toBe(95)
    expect(getNextMilestone(94)).toBe(95)
  })

  it('returns null for scores at or above 95', () => {
    expect(getNextMilestone(95)).toBeNull()
    expect(getNextMilestone(100)).toBeNull()
  })
})

describe('formatMilestone', () => {
  it('formats milestone as percentage', () => {
    expect(formatMilestone(75)).toBe('75%')
    expect(formatMilestone(85)).toBe('85%')
    expect(formatMilestone(95)).toBe('95%')
  })
})

describe('getMilestoneToastContent', () => {
  it('returns correct toast content for milestone', () => {
    const content = getMilestoneToastContent(75)
    expect(content.title).toBe('Milestone reached: 75%')
    expect(content.description).toBe('Content health improving')
  })

  it('returns consistent format for all milestones', () => {
    const milestones = [75, 85, 95]
    milestones.forEach(m => {
      const content = getMilestoneToastContent(m)
      expect(content.title).toContain(`${m}%`)
      expect(content.description).toBe('Content health improving')
    })
  })
})
