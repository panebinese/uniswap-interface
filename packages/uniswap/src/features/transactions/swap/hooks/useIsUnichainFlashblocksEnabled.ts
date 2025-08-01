import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { FeatureFlags } from 'uniswap/src/features/gating/flags'
import { useFeatureFlag } from 'uniswap/src/features/gating/hooks'

/**
 * Hook to determine if Unichain flashblocks feature should be enabled
 * Returns true only when:
 * 1. The UnichainFlashblocks feature flag is enabled
 * 2. The current chain is Unichain mainnet or Unichain sepolia
 */
export function useIsUnichainFlashblocksEnabled(chainId?: UniverseChainId): boolean {
  const flashblocksFlag = useFeatureFlag(FeatureFlags.UnichainFlashblocks)

  if (!flashblocksFlag) {
    return false
  }

  return chainId === UniverseChainId.Unichain || chainId === UniverseChainId.UnichainSepolia
}
