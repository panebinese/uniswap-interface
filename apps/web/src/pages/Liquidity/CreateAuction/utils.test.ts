import { describe, expect, it } from 'vitest'
import { PostAuctionLiquidityAllocationType, UNBOUNDED_TIER_ID } from '~/pages/Liquidity/CreateAuction/types'
import {
  createNextBoundedTier,
  expandCompactNumberInput,
  formatCompactNumberDisplay,
  formatCompactNumberInput,
  getMaxTieredPostAuctionLiquidityEffectivePercent,
  getPostAuctionLiquidityPreviewPercent,
  getPostAuctionLiquidityTierLpDollars,
  isValidPartialPercentInput,
} from '~/pages/Liquidity/CreateAuction/utils'

describe('formatCompactNumberInput', () => {
  it('uses the next suffix when rounding would show 1000 of the smaller unit', () => {
    expect(formatCompactNumberInput(999_999)).toBe('1m')
    expect(formatCompactNumberDisplay(999_999)).toBe('1M')
  })

  it('keeps k when the normalized value stays below 1000 after rounding', () => {
    expect(formatCompactNumberInput(999_500)).toBe('999.5k')
  })
})

describe('isValidPartialPercentInput', () => {
  it('allows empty string', () => {
    expect(isValidPartialPercentInput('')).toBe(true)
  })

  it('allows integer strings', () => {
    expect(isValidPartialPercentInput('25')).toBe(true)
  })

  it('allows partial decimal entry', () => {
    expect(isValidPartialPercentInput('12.')).toBe(true)
    expect(isValidPartialPercentInput('.5')).toBe(true)
  })

  it('rejects more than five fractional digits', () => {
    expect(isValidPartialPercentInput('1.123456')).toBe(false)
  })

  it('rejects multiple dots', () => {
    expect(isValidPartialPercentInput('1.2.3')).toBe(false)
  })
})

describe('getPostAuctionLiquidityTierLpDollars', () => {
  it('computes LP dollars for the first tier (no previous milestone)', () => {
    expect(getPostAuctionLiquidityTierLpDollars({ raiseMilestone: '1m', percent: 50 })).toBe(500_000)
  })

  it('computes LP dollars using the marginal range when previousMilestone is provided', () => {
    // Tier range is 1M to 10M = 9M, at 25% → 2.25M
    expect(getPostAuctionLiquidityTierLpDollars({ raiseMilestone: '10m', percent: 25 }, 1_000_000)).toBe(2_250_000)
  })

  it('returns 0 when tier range is non-positive', () => {
    expect(getPostAuctionLiquidityTierLpDollars({ raiseMilestone: '1m', percent: 50 }, 2_000_000)).toBe(0)
  })
})

describe('getMaxTieredPostAuctionLiquidityEffectivePercent', () => {
  it('returns the tier percent for a single-tier allocation', () => {
    const result = getMaxTieredPostAuctionLiquidityEffectivePercent({
      type: PostAuctionLiquidityAllocationType.TIERED,
      tiers: [{ id: 'tier-1', raiseMilestone: '1m', percent: 50 }],
    })
    expect(result).toBe(50)
  })

  it('returns the first tier percent for decreasing tiers (max is at tier 1 boundary)', () => {
    // Tier 1: ≤$1M at 50% → lpAccum=500k, r_eff=500k/1M=50%
    // Tier 2: ≤$100M at 25% → lpAccum=500k+24.75M=25.25M, r_eff=25.25M/100M=25.25%
    // Max effective percent = 50% (at tier 1)
    const result = getMaxTieredPostAuctionLiquidityEffectivePercent({
      type: PostAuctionLiquidityAllocationType.TIERED,
      tiers: [
        { id: 'tier-1', raiseMilestone: '1m', percent: 50 },
        { id: 'tier-2', raiseMilestone: '100m', percent: 25 },
      ],
    })
    expect(result).toBe(50)
  })

  it('returns the last tier effective percent for increasing tiers (max is at last boundary)', () => {
    // Tier 1: ≤$1M at 25% → lpAccum=250k, r_eff=250k/1M=25%
    // Tier 2: ≤$10M at 50% → lpAccum=250k+4.5M=4.75M, r_eff=4.75M/10M=47.5%
    // Max effective percent = 47.5% (at tier 2)
    const result = getMaxTieredPostAuctionLiquidityEffectivePercent({
      type: PostAuctionLiquidityAllocationType.TIERED,
      tiers: [
        { id: 'tier-1', raiseMilestone: '1m', percent: 25 },
        { id: 'tier-2', raiseMilestone: '10m', percent: 50 },
      ],
    })
    expect(result).toBeCloseTo(47.5)
  })

  it('handles three tiers with decreasing percentages', () => {
    // Tier 1: ≤$1M at 60% → lpAccum=600k, r_eff=60%
    // Tier 2: ≤$10M at 40% → lpAccum=600k+3.6M=4.2M, r_eff=42%
    // Tier 3: ≤$50M at 20% → lpAccum=4.2M+8M=12.2M, r_eff=24.4%
    // Max = 60% at tier 1
    const result = getMaxTieredPostAuctionLiquidityEffectivePercent({
      type: PostAuctionLiquidityAllocationType.TIERED,
      tiers: [
        { id: 'tier-1', raiseMilestone: '1m', percent: 60 },
        { id: 'tier-2', raiseMilestone: '10m', percent: 40 },
        { id: 'tier-3', raiseMilestone: '50m', percent: 20 },
      ],
    })
    expect(result).toBe(60)
  })

  it('uses the unbounded tier percent as a candidate for the max', () => {
    // Only unbounded tier at 50% → max effective = 50%
    const result = getMaxTieredPostAuctionLiquidityEffectivePercent({
      type: PostAuctionLiquidityAllocationType.TIERED,
      tiers: [{ id: UNBOUNDED_TIER_ID, raiseMilestone: '', percent: 50 }],
    })
    expect(result).toBe(50)
  })

  it('picks bounded tier boundary over unbounded when bounded has higher effective rate', () => {
    // Tier 1: ≤$1M at 50% → r_eff=50%
    // Unbounded at 25% → asymptotic r_eff=25%
    // Max = 50% at tier 1
    const result = getMaxTieredPostAuctionLiquidityEffectivePercent({
      type: PostAuctionLiquidityAllocationType.TIERED,
      tiers: [
        { id: 'tier-1', raiseMilestone: '1m', percent: 50 },
        { id: UNBOUNDED_TIER_ID, raiseMilestone: '', percent: 25 },
      ],
    })
    expect(result).toBe(50)
  })

  it('picks unbounded tier when it has the highest effective rate', () => {
    // Tier 1: ≤$1M at 25% → r_eff=25%
    // Unbounded at 100% → asymptotic r_eff=100%
    // Max = 100% (unbounded)
    const result = getMaxTieredPostAuctionLiquidityEffectivePercent({
      type: PostAuctionLiquidityAllocationType.TIERED,
      tiers: [
        { id: 'tier-1', raiseMilestone: '1m', percent: 25 },
        { id: UNBOUNDED_TIER_ID, raiseMilestone: '', percent: 100 },
      ],
    })
    expect(result).toBe(100)
  })
})

describe('getPostAuctionLiquidityPreviewPercent', () => {
  it('returns the single allocation percent for single type', () => {
    expect(
      getPostAuctionLiquidityPreviewPercent({
        type: PostAuctionLiquidityAllocationType.SINGLE,
        percent: 40,
      }),
    ).toBe(40)
  })

  it('returns the max effective percent for tiered allocation', () => {
    // Decreasing tiers: max effective is at tier 1 = 50%
    expect(
      getPostAuctionLiquidityPreviewPercent({
        type: PostAuctionLiquidityAllocationType.TIERED,
        tiers: [
          { id: 'tier-1', raiseMilestone: '1m', percent: 50 },
          { id: 'tier-2', raiseMilestone: '100m', percent: 25 },
        ],
      }),
    ).toBe(50)
  })

  it('returns 0 when tiered allocation has no positive effective LP rate', () => {
    expect(
      getPostAuctionLiquidityPreviewPercent({
        type: PostAuctionLiquidityAllocationType.TIERED,
        tiers: [
          { id: 'tier-1', raiseMilestone: '1m', percent: 0 },
          { id: UNBOUNDED_TIER_ID, raiseMilestone: '', percent: 0 },
        ],
      }),
    ).toBe(0)
  })

  it('clamps sub-minimum effective tiered rate up to the UI minimum', () => {
    expect(
      getPostAuctionLiquidityPreviewPercent({
        type: PostAuctionLiquidityAllocationType.TIERED,
        tiers: [{ id: 'tier-1', raiseMilestone: '1m', percent: 10 }],
      }),
    ).toBe(25)
  })
})

describe('createNextBoundedTier', () => {
  it('uses the default milestone and tier-1 when only an unbounded tier exists', () => {
    const next = createNextBoundedTier([{ id: UNBOUNDED_TIER_ID, raiseMilestone: '', percent: 30 }])
    expect(next).toMatchObject({ id: 'tier-1', raiseMilestone: '100k', percent: 30 })
  })

  it('uses 10× the last bounded milestone and the next numeric id', () => {
    const next = createNextBoundedTier([
      { id: 'tier-1', raiseMilestone: '1m', percent: 20 },
      { id: UNBOUNDED_TIER_ID, raiseMilestone: '', percent: 20 },
    ])
    expect(next).toMatchObject({ id: 'tier-2', raiseMilestone: '10m', percent: 20 })
  })

  it('picks the next id from the max existing tier-N suffix', () => {
    const next = createNextBoundedTier([
      { id: 'tier-1', raiseMilestone: '1m', percent: 15 },
      { id: 'tier-3', raiseMilestone: '10m', percent: 15 },
      { id: UNBOUNDED_TIER_ID, raiseMilestone: '', percent: 15 },
    ])
    expect(next.id).toBe('tier-4')
  })
})

describe('expandCompactNumberInput', () => {
  it('expands compact suffixes with fractional parts', () => {
    expect(expandCompactNumberInput('3.33b')).toBe('3330000000')
    expect(expandCompactNumberInput('1.5m')).toBe('1500000')
  })

  it('expands whole-number compact values', () => {
    expect(expandCompactNumberInput('500k')).toBe('500000')
    expect(expandCompactNumberInput('2t')).toBe('2000000000000')
  })

  it('returns plain digit strings when there is no suffix', () => {
    expect(expandCompactNumberInput('42')).toBe('42')
    expect(expandCompactNumberInput('3.14')).toBe('3.14')
  })

  it('returns null for empty or invalid input', () => {
    expect(expandCompactNumberInput('')).toBeNull()
    expect(expandCompactNumberInput('   ')).toBeNull()
    expect(expandCompactNumberInput('1.2.3k')).toBeNull()
    expect(expandCompactNumberInput('abc')).toBeNull()
    expect(expandCompactNumberInput('k')).toBeNull()
  })

  it('is case-insensitive for suffix letters', () => {
    expect(expandCompactNumberInput('1M')).toBe('1000000')
    expect(expandCompactNumberInput('1B')).toBe('1000000000')
  })
})
