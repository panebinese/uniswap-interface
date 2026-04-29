import { type Currency, type CurrencyAmount } from '@uniswap/sdk-core'
import { useTranslation } from 'react-i18next'
import { Flex, Text } from 'ui/src'
import type { UniverseChainId } from 'uniswap/src/features/chains/types'
import { useLocalizationContext } from 'uniswap/src/features/language/LocalizationContext'
import { NumberType } from 'utilities/src/format/types'
import { useCreateAuctionDistributionBarColors } from '~/pages/Liquidity/CreateAuction/hooks/useCreateAuctionDistributionBarColors'
import { type RaiseCurrency } from '~/pages/Liquidity/CreateAuction/types'
import { amountToPercent } from '~/pages/Liquidity/CreateAuction/utils'

const BAR_GAP_PX = 4
const SOLD_BRACKET_HEIGHT_PX = 8
const SOLD_BRACKET_RADIUS_PX = 4

interface TokenDistributionBarProps {
  label?: string
  auctionSupplyAmount: CurrencyAmount<Currency>
  postAuctionLiquidityAmount: CurrencyAmount<Currency>
  tokenSymbol: string
  chainId: UniverseChainId
  raiseCurrency: RaiseCurrency
  tokenColor?: string
}

export function TokenDistributionBar({
  label,
  auctionSupplyAmount,
  postAuctionLiquidityAmount,
  tokenSymbol,
  chainId,
  raiseCurrency,
  tokenColor,
}: TokenDistributionBarProps) {
  const { t } = useTranslation()
  const { formatNumberOrString } = useLocalizationContext()
  const { fundraiseColor, raiseSideLpColor, tokenSideLpColor } = useCreateAuctionDistributionBarColors({
    chainId,
    raiseCurrency,
    tokenColor,
  })
  const formatAmount = (amount: CurrencyAmount<Currency>): string =>
    formatNumberOrString({
      value: amount.toExact(),
      type: NumberType.TokenQuantityStats,
      placeholder: '0',
    })

  // auctionSupplyAmount = deposited tokens D = sold S + reserve R with R = r·S. Each LP token leg = postAuctionLiquidityAmount = r·S = R.
  const soldAmount = auctionSupplyAmount.subtract(postAuctionLiquidityAmount)
  const fundraiseAmount = soldAmount.subtract(postAuctionLiquidityAmount)
  const fundraisePercent = amountToPercent(auctionSupplyAmount, fundraiseAmount)
  const lpLegPercent = amountToPercent(auctionSupplyAmount, postAuctionLiquidityAmount)
  const totalSoldPercent = amountToPercent(auctionSupplyAmount, soldAmount)

  const showFundraise = fundraisePercent > 0
  // Bar row uses fixed px gaps between flex segments; sold width must use the same flex
  // basis as the colored segments, not a flat % of the full row (which ignores gaps).
  const barSegmentCount = showFundraise ? 3 : 2
  const barGapCount = barSegmentCount - 1
  const gapsInsideSoldRegion = showFundraise ? 1 : 0
  const soldFraction = Math.min(totalSoldPercent, 100) / 100
  const totalSoldWidth = `calc((100% - ${
    barGapCount * BAR_GAP_PX
  }px) * ${soldFraction} + ${gapsInsideSoldRegion * BAR_GAP_PX}px)`

  return (
    <Flex gap="$spacing12">
      {label && (
        <Text variant="body3" color="$neutral2">
          {label}
        </Text>
      )}

      <Flex gap="$spacing4">
        {totalSoldPercent > 0 && (
          <Flex row alignItems="flex-end" gap="$spacing8" width={totalSoldWidth} maxWidth="100%">
            <Flex row flex={1} alignItems="flex-start">
              <Flex
                width={SOLD_BRACKET_RADIUS_PX}
                height={SOLD_BRACKET_HEIGHT_PX}
                borderTopWidth={1}
                borderLeftWidth={1}
                borderTopLeftRadius={SOLD_BRACKET_RADIUS_PX}
                borderColor="$neutral3"
              />
              <Flex flex={1} height={1} backgroundColor="$neutral3" />
            </Flex>
            <Flex row alignItems="center" gap="$spacing4">
              <Text variant="body4" color="$neutral1">
                {formatAmount(soldAmount)}
              </Text>
              <Text variant="body4" color="$neutral2">
                {t('common.sold').toLowerCase()}
              </Text>
            </Flex>
            <Flex row flex={1} alignItems="flex-start">
              <Flex flex={1} height={1} backgroundColor="$neutral3" />
              <Flex
                width={SOLD_BRACKET_RADIUS_PX}
                height={SOLD_BRACKET_HEIGHT_PX}
                borderTopWidth={1}
                borderRightWidth={1}
                borderTopRightRadius={SOLD_BRACKET_RADIUS_PX}
                borderColor="$neutral3"
              />
            </Flex>
          </Flex>
        )}

        <Flex row height="$spacing12" gap={BAR_GAP_PX}>
          {showFundraise && (
            <Flex
              flex={fundraisePercent}
              height="$spacing12"
              borderRadius="$rounded4"
              backgroundColor={fundraiseColor}
            />
          )}
          <Flex flex={lpLegPercent} height="$spacing12" borderRadius="$rounded4" backgroundColor={raiseSideLpColor} />
          <Flex flex={lpLegPercent} height="$spacing12" borderRadius="$rounded4" backgroundColor={tokenSideLpColor} />
        </Flex>
      </Flex>

      <Flex row gap="$spacing12" flexWrap="wrap" alignItems="center">
        {showFundraise && (
          <Flex row gap="$spacing4" alignItems="center">
            <Flex width={8} height={8} borderRadius="$roundedFull" backgroundColor={fundraiseColor} />
            <Text variant="body4" color="$neutral1">
              {formatAmount(fundraiseAmount)}
            </Text>
            <Text variant="body4" color="$neutral2">
              {t('toucan.createAuction.step.configureAuction.distribution.fundraiseSold', {
                raiseToken: raiseCurrency,
              })}
            </Text>
          </Flex>
        )}
        <>
          <Flex row gap="$spacing4" alignItems="center">
            <Flex width={8} height={8} borderRadius="$roundedFull" backgroundColor={raiseSideLpColor} />
            <Text variant="body4" color="$neutral1">
              {formatAmount(postAuctionLiquidityAmount)}
            </Text>
            <Text variant="body4" color="$neutral2">
              {t('toucan.createAuction.step.configureAuction.distribution.tokenLpSoldRaiseSide', {
                token: raiseCurrency,
              })}
            </Text>
          </Flex>
          <Flex row gap="$spacing4" alignItems="center">
            <Flex width={8} height={8} borderRadius="$roundedFull" backgroundColor={tokenSideLpColor} />
            <Text variant="body4" color="$neutral1">
              {formatAmount(postAuctionLiquidityAmount)}
            </Text>
            <Text variant="body4" color="$neutral2">
              {t('toucan.createAuction.step.configureAuction.distribution.tokenLpReservedTokenSide', {
                token: tokenSymbol,
              })}
            </Text>
          </Flex>
        </>
      </Flex>
    </Flex>
  )
}
