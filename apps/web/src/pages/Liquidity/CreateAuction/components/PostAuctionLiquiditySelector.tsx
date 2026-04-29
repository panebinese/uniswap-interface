import { useCallback, useRef, useState, type ComponentRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Flex, Input, Text, Tooltip, TouchableArea } from 'ui/src'
import { QuestionInCircleFilled } from 'ui/src/components/icons/QuestionInCircleFilled'
import { fonts } from 'ui/src/theme'
import { zIndexes } from 'ui/src/theme/zIndexes'
import { PercentButton } from '~/pages/Liquidity/CreateAuction/components/PercentButton'
import { PostAuctionLiquidityAllocationPopover } from '~/pages/Liquidity/CreateAuction/components/PostAuctionLiquidityAllocationPopover'
import { PostAuctionLiquidityTieredEditor } from '~/pages/Liquidity/CreateAuction/components/PostAuctionLiquidityTieredEditor'
import {
  MAX_POST_AUCTION_LIQUIDITY_PERCENT,
  MIN_POST_AUCTION_LIQUIDITY_PERCENT,
  type PostAuctionLiquidityAllocation,
  PostAuctionLiquidityAllocationType,
  type PostAuctionLiquidityTier,
} from '~/pages/Liquidity/CreateAuction/types'
import {
  isValidPartialPercentInput,
  MAX_POST_AUCTION_PARTIAL_PERCENT_DECIMAL_PLACES,
} from '~/pages/Liquidity/CreateAuction/utils'

type InputRef = ComponentRef<typeof Input>

const QUICK_SELECT_PERCENTS = [25, 50, 75, 100] as const

function formatPostAuctionPercentForUi(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) {
    return ''
  }

  const normalized =
    Math.round(percent * 10 ** MAX_POST_AUCTION_PARTIAL_PERCENT_DECIMAL_PLACES) /
    10 ** MAX_POST_AUCTION_PARTIAL_PERCENT_DECIMAL_PLACES
  return normalized.toFixed(MAX_POST_AUCTION_PARTIAL_PERCENT_DECIMAL_PLACES).replace(/\.?0+$/, '')
}

interface PostAuctionLiquiditySelectorProps {
  allocation: PostAuctionLiquidityAllocation
  postAuctionLiquidityPercent: number
  raiseCurrencySymbol: string
  subtitle: string
  showSubtitleTooltip: boolean
  onAllocationTypeSelect: (type: PostAuctionLiquidityAllocationType) => void
  onSelectPercent: (percent: number) => void
  onAddTier: () => void
  onUpdateTier: (tierId: string, config: Partial<Pick<PostAuctionLiquidityTier, 'raiseMilestone' | 'percent'>>) => void
  onRemoveTier: (tierId: string) => void
}

export function PostAuctionLiquiditySelector({
  allocation,
  postAuctionLiquidityPercent,
  raiseCurrencySymbol,
  subtitle,
  showSubtitleTooltip,
  onAllocationTypeSelect,
  onSelectPercent,
  onAddTier,
  onUpdateTier,
  onRemoveTier,
}: PostAuctionLiquiditySelectorProps) {
  const { t } = useTranslation()
  const inputRef = useRef<InputRef>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [rawInput, setRawInput] = useState('')
  const [showMinTooltip, setShowMinTooltip] = useState(false)

  const clampCaret = useCallback(() => {
    const el = inputRef.current as unknown as HTMLInputElement | null
    if (!el) {
      return
    }

    const max = el.value.length - 1
    if ((el.selectionStart ?? 0) > max || (el.selectionEnd ?? 0) > max) {
      el.setSelectionRange(Math.min(el.selectionStart ?? max, max), Math.min(el.selectionEnd ?? max, max))
    }
  }, [])

  const parsedInput = isFocused ? Number(rawInput) : null
  const isInvalid =
    parsedInput !== null &&
    rawInput !== '' &&
    Number.isFinite(parsedInput) &&
    (parsedInput < MIN_POST_AUCTION_LIQUIDITY_PERCENT || parsedInput > MAX_POST_AUCTION_LIQUIDITY_PERCENT)

  const handleChange = useCallback(
    (value: string) => {
      if (!isValidPartialPercentInput(value)) {
        return
      }

      setRawInput(value)
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return
      }

      setShowMinTooltip(parsed < MIN_POST_AUCTION_LIQUIDITY_PERCENT)
      onSelectPercent(
        Math.min(Math.max(parsed, MIN_POST_AUCTION_LIQUIDITY_PERCENT), MAX_POST_AUCTION_LIQUIDITY_PERCENT),
      )
    },
    [onSelectPercent],
  )

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setShowMinTooltip(false)
    setRawInput(formatPostAuctionPercentForUi(postAuctionLiquidityPercent))
  }, [postAuctionLiquidityPercent])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    setShowMinTooltip(false)

    const parsed = Number(rawInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return
    }

    onSelectPercent(Math.min(Math.max(parsed, MIN_POST_AUCTION_LIQUIDITY_PERCENT), MAX_POST_AUCTION_LIQUIDITY_PERCENT))
  }, [onSelectPercent, rawInput])

  const handleSelectPercent = useCallback(
    (percent: number) => {
      setIsFocused(false)
      setRawInput('')
      setShowMinTooltip(false)
      onSelectPercent(percent)
    },
    [onSelectPercent],
  )

  const isMinActive = postAuctionLiquidityPercent === MIN_POST_AUCTION_LIQUIDITY_PERCENT
  const isTiered = allocation.type === PostAuctionLiquidityAllocationType.TIERED
  const label = isTiered
    ? t('toucan.createAuction.step.configureAuction.postAuctionLiquidity.tieredLabel')
    : t('toucan.createAuction.step.configureAuction.postAuctionLiquidity.label', {
        raiseCurrency: raiseCurrencySymbol,
      })

  const headerHelpDescription = isTiered
    ? t('toucan.createAuction.step.configureAuction.postAuctionLiquidity.tieredAllocationDescription', {
        raiseCurrency: raiseCurrencySymbol,
      })
    : t('toucan.createAuction.step.configureAuction.postAuctionLiquidity.singleAllocationDescription', {
        raiseCurrency: raiseCurrencySymbol,
      })

  return (
    <Flex
      backgroundColor="$surface2"
      borderWidth="$spacing1"
      borderColor="$surface3"
      borderRadius="$rounded16"
      p="$spacing16"
      gap="$spacing8"
    >
      <Flex row alignItems="center" justifyContent="space-between" gap="$spacing8">
        <Flex row alignItems="center" gap="$spacing4">
          <Text variant="buttonLabel3" color="$neutral2">
            {label}
          </Text>
          <Tooltip placement="top">
            <Tooltip.Trigger asChild>
              <Flex cursor="help" aria-label={headerHelpDescription}>
                <QuestionInCircleFilled size="$icon.16" color="$neutral3" />
              </Flex>
            </Tooltip.Trigger>
            <Tooltip.Content zIndex={zIndexes.overlay}>
              <Tooltip.Arrow />
              <Text variant="body4" color="$neutral1" maxWidth={280}>
                {headerHelpDescription}
              </Text>
            </Tooltip.Content>
          </Tooltip>
        </Flex>

        <PostAuctionLiquidityAllocationPopover
          allocationType={allocation.type}
          raiseCurrencySymbol={raiseCurrencySymbol}
          onSelectType={onAllocationTypeSelect}
        />
      </Flex>

      {isTiered ? (
        <PostAuctionLiquidityTieredEditor
          raiseCurrencySymbol={raiseCurrencySymbol}
          tiers={allocation.tiers}
          onAddTier={onAddTier}
          onUpdateTier={onUpdateTier}
          onRemoveTier={onRemoveTier}
        />
      ) : (
        <Flex row alignItems="center">
          <Flex flex={1} flexBasis={0} minWidth={0} gap="$spacing4">
            {isFocused ? (
              <Input
                ref={inputRef}
                autoFocus
                height={fonts.heading3.lineHeight}
                value={`${rawInput}%`}
                onChangeText={(value: string) => handleChange(value.replace(/%/g, ''))}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onSelectionChange={clampCaret}
                placeholder="0%"
                placeholderTextColor="$neutral3"
                fontSize={fonts.heading3.fontSize}
                lineHeight={fonts.heading3.lineHeight}
                fontWeight={fonts.heading3.fontWeight}
                color={isInvalid ? '$statusCritical' : '$neutral1'}
                px="$none"
                backgroundColor="$transparent"
                width="100%"
              />
            ) : (
              <Text variant="heading3" color="$neutral1" cursor="text" onPress={handleFocus}>
                {`${formatPostAuctionPercentForUi(postAuctionLiquidityPercent) || '0'}%`}
              </Text>
            )}

            {showSubtitleTooltip ? (
              <Tooltip placement="left">
                <Tooltip.Trigger asChild>
                  <Flex cursor="help" alignSelf="flex-start">
                    <Text variant="body4" color="$neutral2">
                      {subtitle}
                    </Text>
                  </Flex>
                </Tooltip.Trigger>
                <Tooltip.Content zIndex={zIndexes.overlay}>
                  <Tooltip.Arrow />
                  <Text variant="body4" color="$neutral1" maxWidth={280}>
                    {t('toucan.createAuction.step.configureAuction.postAuctionLiquidity.subtitleFloorPriceTooltip')}
                  </Text>
                </Tooltip.Content>
              </Tooltip>
            ) : (
              <Flex alignSelf="flex-start">
                <Text variant="body4" color="$neutral2">
                  {subtitle}
                </Text>
              </Flex>
            )}
          </Flex>

          <Flex row flex={1} flexBasis={0} minWidth={0} gap="$spacing2">
            <Tooltip placement="bottom" open={showMinTooltip}>
              <TouchableArea
                flex={1}
                minWidth={0}
                backgroundColor={isMinActive ? '$surface3' : 'transparent'}
                borderWidth="$spacing1"
                borderColor="$surface3"
                borderRadius="$rounded16"
                px="$spacing8"
                py="$spacing6"
                onPress={handleSelectPercent.bind(null, MIN_POST_AUCTION_LIQUIDITY_PERCENT)}
              >
                <Tooltip.Trigger asChild>
                  <Flex flex={1} alignItems="center" justifyContent="center">
                    <Text variant="buttonLabel4" color="$neutral1">
                      {`${MIN_POST_AUCTION_LIQUIDITY_PERCENT}%`}
                    </Text>
                  </Flex>
                </Tooltip.Trigger>
              </TouchableArea>
              <Tooltip.Content zIndex={zIndexes.overlay}>
                <Tooltip.Arrow />
                <Text variant="body4" color="$neutral1" maxWidth={250}>
                  {t('toucan.createAuction.step.configureAuction.postAuctionLiquidity.minTooltip')}
                </Text>
              </Tooltip.Content>
            </Tooltip>

            {QUICK_SELECT_PERCENTS.filter((pct) => pct !== MIN_POST_AUCTION_LIQUIDITY_PERCENT).map((pct) => (
              <PercentButton
                key={pct}
                label={`${pct}%`}
                isActive={postAuctionLiquidityPercent === pct}
                onPress={handleSelectPercent.bind(null, pct)}
              />
            ))}
          </Flex>
        </Flex>
      )}
    </Flex>
  )
}
