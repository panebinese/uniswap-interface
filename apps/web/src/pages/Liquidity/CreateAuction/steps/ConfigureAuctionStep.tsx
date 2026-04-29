import { type Currency, type CurrencyAmount } from '@uniswap/sdk-core'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Flex, Text } from 'ui/src'
import { AuctionAdvancedSettings } from '~/pages/Liquidity/CreateAuction/components/AuctionAdvancedSettings'
import { AuctionDistributionSection } from '~/pages/Liquidity/CreateAuction/components/AuctionDistributionSection'
import { AuctionSupplySection } from '~/pages/Liquidity/CreateAuction/components/AuctionSupplySection'
import { DurationSection } from '~/pages/Liquidity/CreateAuction/components/DurationSection'
import { HookTile } from '~/pages/Liquidity/CreateAuction/components/HookTile'
import { PostAuctionLiquiditySection } from '~/pages/Liquidity/CreateAuction/components/PostAuctionLiquiditySection'
import { PriceSettingsSection } from '~/pages/Liquidity/CreateAuction/components/PriceSettingsSection'
import { TokenSummaryCard, useTokenSummaryCardProps } from '~/pages/Liquidity/CreateAuction/components/TokenSummaryCard'
import {
  useCreateAuctionStore,
  useCreateAuctionStoreActions,
} from '~/pages/Liquidity/CreateAuction/CreateAuctionContext'
import { useCreateAuctionTokenColor } from '~/pages/Liquidity/CreateAuction/hooks/useCreateAuctionTokenColor'
import { useCreateAuctionTokenLogoNode } from '~/pages/Liquidity/CreateAuction/hooks/useCreateAuctionTokenLogoNode'
import { useIsStepValid } from '~/pages/Liquidity/CreateAuction/hooks/useIsStepValid'
import {
  AuctionType,
  type ConfigureAuctionFormState,
  CreateAuctionStep,
  PostAuctionLiquidityAllocationType,
} from '~/pages/Liquidity/CreateAuction/types'
import {
  percentOfSoldToLiquidityFromDepositAndLiquidityAmount,
  percentOfAmount,
} from '~/pages/Liquidity/CreateAuction/utils'

const AUCTION_DISTRIBUTION_TOKEN_LOGO_SIZE = 24

export function ConfigureAuctionStep() {
  const { t } = useTranslation()
  const tokenColor = useCreateAuctionTokenColor()
  const tokenSummaryCardProps = useTokenSummaryCardProps()
  const auctionDistributionTokenLogo = useCreateAuctionTokenLogoNode(AUCTION_DISTRIBUTION_TOKEN_LOGO_SIZE, {
    hideNetworkLogo: true,
  })
  const configureAuction: ConfigureAuctionFormState = useCreateAuctionStore((state) => state.configureAuction)

  const {
    goToPreviousStep,
    goToNextStep,
    setAuctionType,
    addPostAuctionLiquidityTier,
    removePostAuctionLiquidityTier,
    setAuctionConfig,
    setSinglePostAuctionLiquidityPercent,
    setStartTime,
    setMaxDurationDays,
    setPostAuctionLiquidityAllocationType,
    setRaiseCurrency,
    setFloorPrice,
    updatePostAuctionLiquidityTier,
  } = useCreateAuctionStoreActions()

  const {
    startTime,
    maxDurationDays,
    activeAuctionType,
    committed,
    postAuctionLiquidityAllocation,
    raiseCurrency,
    floorPrice,
  } = configureAuction
  const isNextStepDisabled = !useIsStepValid(CreateAuctionStep.CONFIGURE_AUCTION)

  const handleBootstrapLiquidity = useCallback(() => setAuctionType(AuctionType.BOOTSTRAP_LIQUIDITY), [setAuctionType])
  const handleFundraise = useCallback(() => setAuctionType(AuctionType.FUNDRAISE), [setAuctionType])
  const handleStartTimeChange = useCallback((date: Date | undefined) => setStartTime(date), [setStartTime])
  const handleDecrement = useCallback(
    () => setMaxDurationDays(Math.max(1, maxDurationDays - 1)),
    [setMaxDurationDays, maxDurationDays],
  )
  const handleIncrement = useCallback(
    () => setMaxDurationDays(maxDurationDays + 1),
    [setMaxDurationDays, maxDurationDays],
  )

  const handleAuctionSupplyPercentChange = useCallback(
    (percent: number) => {
      if (!committed) {
        return
      }
      const newAuctionSupply = percentOfAmount(committed.totalSupply, percent)
      setAuctionConfig({ auctionSupplyAmount: newAuctionSupply })
    },
    [committed, setAuctionConfig],
  )

  const handleAuctionSupplyAmountChange = useCallback(
    (newAuctionSupply: CurrencyAmount<Currency>) => {
      if (!committed) {
        return
      }
      setAuctionConfig({ auctionSupplyAmount: newAuctionSupply })
    },
    [committed, setAuctionConfig],
  )

  const handlePostAuctionLiquidityPercentChange = useCallback(
    (percent: number) => {
      setSinglePostAuctionLiquidityPercent(percent)
    },
    [setSinglePostAuctionLiquidityPercent],
  )

  const postAuctionLiquidityPercent = useMemo(() => {
    if (!committed) {
      return 0
    }
    return percentOfSoldToLiquidityFromDepositAndLiquidityAmount(
      committed.auctionSupplyAmount,
      committed.postAuctionLiquidityAmount,
    )
  }, [committed])

  if (!committed) {
    return null
  }

  const { totalSupply, auctionSupplyAmount } = committed
  const tokenSymbol = totalSupply.currency.symbol ?? ''

  return (
    <Flex gap="$spacing16">
      <TokenSummaryCard {...tokenSummaryCardProps} onEdit={goToPreviousStep} />

      <Flex row gap="$spacing12">
        <HookTile
          selected={activeAuctionType === AuctionType.BOOTSTRAP_LIQUIDITY}
          title={t('toucan.createAuction.step.configureAuction.auctionType.bootstrapLiquidity')}
          titleVariant="buttonLabel2"
          description={t('toucan.createAuction.step.configureAuction.auctionType.bootstrapLiquidity.description')}
          descriptionVariant="body3"
          onPress={handleBootstrapLiquidity}
        />
        <HookTile
          selected={activeAuctionType === AuctionType.FUNDRAISE}
          title={t('toucan.createAuction.step.configureAuction.auctionType.fundraise')}
          titleVariant="buttonLabel2"
          description={t('toucan.createAuction.step.configureAuction.auctionType.fundraise.description')}
          descriptionVariant="body3"
          onPress={handleFundraise}
        />
      </Flex>

      <Flex
        backgroundColor="$surface1"
        borderWidth="$spacing1"
        borderColor="$surface3"
        borderRadius="$rounded20"
        p="$spacing24"
        gap="$spacing24"
      >
        <Text variant="heading3" color="$neutral1" pb="$spacing12">
          {t('toucan.createAuction.step.configureAuction.title')}
        </Text>

        <Flex gap="$spacing40">
          <DurationSection
            maxDurationDays={maxDurationDays}
            startTime={startTime}
            onStartTimeChange={handleStartTimeChange}
            onDecrement={handleDecrement}
            onIncrement={handleIncrement}
          />

          <AuctionSupplySection
            auctionSupplyAmount={auctionSupplyAmount}
            tokenTotalSupply={totalSupply}
            tokenSymbol={tokenSymbol}
            onSelectAuctionSupplyPercent={handleAuctionSupplyPercentChange}
            onAuctionSupplyAmountChange={handleAuctionSupplyAmountChange}
          />

          <PriceSettingsSection
            chainId={totalSupply.currency.chainId}
            raiseCurrency={raiseCurrency}
            onSelect={setRaiseCurrency}
            floorPrice={floorPrice}
            tokenTotalSupply={totalSupply}
            onFloorPriceChange={setFloorPrice}
          />

          <PostAuctionLiquiditySection
            allocation={postAuctionLiquidityAllocation}
            postAuctionLiquidityPercent={postAuctionLiquidityPercent}
            auctionSupplyAmount={auctionSupplyAmount}
            postAuctionLiquidityAmount={committed.postAuctionLiquidityAmount}
            floorPrice={floorPrice}
            raiseCurrency={raiseCurrency}
            chainId={totalSupply.currency.chainId}
            tokenSymbol={tokenSymbol}
            onAllocationTypeSelect={setPostAuctionLiquidityAllocationType}
            onSelectPercent={handlePostAuctionLiquidityPercentChange}
            onAddTier={addPostAuctionLiquidityTier}
            onUpdateTier={updatePostAuctionLiquidityTier}
            onRemoveTier={removePostAuctionLiquidityTier}
          />

          {postAuctionLiquidityAllocation.type === PostAuctionLiquidityAllocationType.SINGLE && (
            <AuctionDistributionSection
              auctionSupplyAmount={auctionSupplyAmount}
              postAuctionLiquidityAmount={committed.postAuctionLiquidityAmount}
              tokenSymbol={tokenSymbol}
              raiseCurrency={raiseCurrency}
              chainId={totalSupply.currency.chainId}
              tokenColor={tokenColor}
              tokenLogoNode={auctionDistributionTokenLogo}
            />
          )}
        </Flex>
        <AuctionAdvancedSettings />
      </Flex>

      <Flex row>
        <Button
          size="medium"
          emphasis="primary"
          onPress={goToNextStep}
          isDisabled={isNextStepDisabled}
          fill
          backgroundColor={tokenColor}
        >
          {t('common.button.continue')}
        </Button>
      </Flex>
    </Flex>
  )
}
