import { describe, expect, it } from 'vitest'
import { createCreateAuctionStore } from '~/pages/Liquidity/CreateAuction/store/createCreateAuctionStore'
import {
  MAX_POST_AUCTION_LIQUIDITY_TIERS,
  PostAuctionLiquidityAllocationType,
} from '~/pages/Liquidity/CreateAuction/types'
import { percentOfSoldToLiquidityFromDepositAndLiquidityAmount } from '~/pages/Liquidity/CreateAuction/utils'

describe('createCreateAuctionStore', () => {
  it('starts with single post-auction liquidity allocation', () => {
    const store = createCreateAuctionStore()
    const allocation = store.getState().configureAuction.postAuctionLiquidityAllocation

    expect(allocation.type).toBe(PostAuctionLiquidityAllocationType.SINGLE)
    if (allocation.type !== PostAuctionLiquidityAllocationType.SINGLE) {
      throw new Error('expected single allocation')
    }
    expect(allocation.percent).toBe(100)
  })

  it('keeps flat tiered allocation equivalent to single allocation', () => {
    const store = createCreateAuctionStore()
    const { actions } = store.getState()

    actions.commitTokenFormAndAdvance()
    actions.setSinglePostAuctionLiquidityPercent(50)
    actions.setFloorPrice('0.1')

    const singleAllocationLiquidityAmount = store
      .getState()
      .configureAuction.committed!.postAuctionLiquidityAmount.toExact()

    actions.setPostAuctionLiquidityAllocationType(PostAuctionLiquidityAllocationType.TIERED)

    let state = store.getState()
    let allocation = state.configureAuction.postAuctionLiquidityAllocation
    expect(allocation.type).toBe(PostAuctionLiquidityAllocationType.TIERED)
    if (allocation.type !== PostAuctionLiquidityAllocationType.TIERED) {
      throw new Error('expected tiered allocation')
    }
    expect(state.configureAuction.committed!.postAuctionLiquidityAmount.toExact()).toBe(singleAllocationLiquidityAmount)

    actions.addPostAuctionLiquidityTier()

    state = store.getState()
    allocation = state.configureAuction.postAuctionLiquidityAllocation
    expect(allocation.type).toBe(PostAuctionLiquidityAllocationType.TIERED)
    if (allocation.type !== PostAuctionLiquidityAllocationType.TIERED) {
      throw new Error('expected tiered allocation')
    }
    expect(allocation.tiers).toHaveLength(2)
    expect(allocation.tiers[0]?.percent).toBe(50)
    expect(allocation.tiers[1]?.percent).toBe(50)
    expect(state.configureAuction.committed!.postAuctionLiquidityAmount.toExact()).toBe(singleAllocationLiquidityAmount)
  })

  it('resolves tiered liquidity from the tier whose raise range matches the final raise', () => {
    const store = createCreateAuctionStore()
    const { actions } = store.getState()

    actions.commitTokenFormAndAdvance()
    actions.setSinglePostAuctionLiquidityPercent(60)

    let state = store.getState()
    let allocation = state.configureAuction.postAuctionLiquidityAllocation
    expect(allocation.type).toBe(PostAuctionLiquidityAllocationType.SINGLE)
    if (allocation.type !== PostAuctionLiquidityAllocationType.SINGLE) {
      throw new Error('expected single allocation')
    }
    expect(allocation.percent).toBe(60)
    expect(
      percentOfSoldToLiquidityFromDepositAndLiquidityAmount(
        state.configureAuction.committed!.auctionSupplyAmount,
        state.configureAuction.committed!.postAuctionLiquidityAmount,
      ),
    ).toBe(60)

    actions.setFloorPrice('0.1')
    actions.setPostAuctionLiquidityAllocationType(PostAuctionLiquidityAllocationType.TIERED)

    state = store.getState()
    allocation = state.configureAuction.postAuctionLiquidityAllocation
    expect(allocation.type).toBe(PostAuctionLiquidityAllocationType.TIERED)
    if (allocation.type !== PostAuctionLiquidityAllocationType.TIERED) {
      throw new Error('expected tiered allocation')
    }
    actions.addPostAuctionLiquidityTier()
    actions.addPostAuctionLiquidityTier()
    actions.updatePostAuctionLiquidityTier('tier-1', { raiseMilestone: '10m', percent: 85 })
    actions.updatePostAuctionLiquidityTier('tier-2', { raiseMilestone: '20m', percent: 40 })

    state = store.getState()
    allocation = state.configureAuction.postAuctionLiquidityAllocation
    expect(allocation.type).toBe(PostAuctionLiquidityAllocationType.TIERED)
    if (allocation.type !== PostAuctionLiquidityAllocationType.TIERED) {
      throw new Error('expected tiered allocation')
    }
    // 3 tiers: tier-1 (bounded), tier-2 (bounded), unbounded
    expect(allocation.tiers).toHaveLength(3)
    expect(allocation.tiers[0]?.raiseMilestone).toBe('10m')
    expect(allocation.tiers[1]?.raiseMilestone).toBe('20m')

    actions.removePostAuctionLiquidityTier('tier-2')
    actions.setFloorPrice('0.02')

    state = store.getState()
    allocation = state.configureAuction.postAuctionLiquidityAllocation
    expect(allocation.type).toBe(PostAuctionLiquidityAllocationType.TIERED)
    if (allocation.type !== PostAuctionLiquidityAllocationType.TIERED) {
      throw new Error('expected tiered allocation')
    }
    // 2 tiers remain: tier-1 (bounded) + unbounded
    expect(allocation.tiers).toHaveLength(2)
    expect(state.configureAuction.committed!.postAuctionLiquidityAmount.toExact()).toBe('114864864.864864864864864864')
  })

  it('limits tiered allocation to ten tiers', () => {
    const store = createCreateAuctionStore()
    const { actions } = store.getState()

    actions.commitTokenFormAndAdvance()
    actions.setFloorPrice('0.1')
    actions.setPostAuctionLiquidityAllocationType(PostAuctionLiquidityAllocationType.TIERED)

    for (let i = 1; i < MAX_POST_AUCTION_LIQUIDITY_TIERS; i++) {
      actions.addPostAuctionLiquidityTier()
    }

    let state = store.getState()
    let allocation = state.configureAuction.postAuctionLiquidityAllocation
    expect(allocation.type).toBe(PostAuctionLiquidityAllocationType.TIERED)
    if (allocation.type !== PostAuctionLiquidityAllocationType.TIERED) {
      throw new Error('expected tiered allocation')
    }
    expect(allocation.tiers).toHaveLength(MAX_POST_AUCTION_LIQUIDITY_TIERS)

    actions.addPostAuctionLiquidityTier()

    state = store.getState()
    allocation = state.configureAuction.postAuctionLiquidityAllocation
    expect(allocation.type).toBe(PostAuctionLiquidityAllocationType.TIERED)
    if (allocation.type !== PostAuctionLiquidityAllocationType.TIERED) {
      throw new Error('expected tiered allocation')
    }
    expect(allocation.tiers).toHaveLength(MAX_POST_AUCTION_LIQUIDITY_TIERS)
  })
})
