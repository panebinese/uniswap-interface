import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Flex, Input, Text, TouchableArea } from 'ui/src'
import { Plus } from 'ui/src/components/icons/Plus'
import { X } from 'ui/src/components/icons/X'
import { MAX_POST_AUCTION_LIQUIDITY_TIERS, type PostAuctionLiquidityTier } from '~/pages/Liquidity/CreateAuction/types'
import {
  formatCompactNumberDisplay,
  getMinimumPostAuctionLiquidityTierMilestone,
  getPostAuctionLiquidityTierLpDollars,
  isAllowedCompactNumberInput,
  isUnboundedTier,
  isValidPartialPercentInput,
  parseCompactNumberInput,
} from '~/pages/Liquidity/CreateAuction/utils'

function formatTierLiquidityTotal(raiseAmount: number, raiseCurrencySymbol: string): string {
  const amount = raiseAmount > 0 ? formatCompactNumberDisplay(raiseAmount) : '0'
  return `${amount} ${raiseCurrencySymbol}`
}

function TierField({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <Flex
      row
      alignItems="center"
      justifyContent="space-between"
      backgroundColor="$surface1"
      borderWidth="$spacing1"
      borderColor="$surface3"
      borderRadius="$rounded8"
      height={32}
      px="$spacing8"
      gap="$spacing8"
    >
      <Flex row flex={1} minWidth={0} alignItems="center" gap="$spacing4">
        {children}
      </Flex>
      {trailing}
    </Flex>
  )
}

function PercentInput({ percent, onUpdatePercent }: { percent: number; onUpdatePercent: (percent: number) => void }) {
  const [percentInput, setPercentInput] = useState(percent.toString())

  useEffect(() => {
    setPercentInput(percent.toString())
  }, [percent])

  return (
    <>
      <Input
        unstyled
        value={percentInput}
        onChangeText={(value) => {
          if (!isValidPartialPercentInput(value)) {
            return
          }

          setPercentInput(value)
          const parsed = Number(value)
          if (Number.isFinite(parsed) && parsed > 0) {
            onUpdatePercent(parsed)
          }
        }}
        onBlur={() => {
          const parsed = Number(percentInput)
          if (!Number.isFinite(parsed) || parsed <= 0) {
            setPercentInput(percent.toString())
            return
          }
          setPercentInput(parsed.toString())
          onUpdatePercent(parsed)
        }}
        placeholder="25"
        placeholderTextColor="$neutral3"
        color="$neutral1"
        outlineStyle="none"
        fontSize={14}
        lineHeight={18}
        $platform-web={{
          fieldSizing: 'content',
          minWidth: '1ch',
          maxWidth: '100%',
        }}
      />
      <Text variant="body3" color="$neutral3" flexShrink={0}>
        %
      </Text>
    </>
  )
}

function BoundedTierRow({
  tier,
  previousMilestone,
  raiseCurrencySymbol,
  onUpdateMilestone,
  onUpdatePercent,
  onRemove,
}: {
  tier: PostAuctionLiquidityTier
  previousMilestone?: number
  raiseCurrencySymbol: string
  onUpdateMilestone: (value: string) => void
  onUpdatePercent: (percent: number) => void
  onRemove: () => void
}) {
  const [milestoneInput, setMilestoneInput] = useState(tier.raiseMilestone)
  const minimumMilestone = getMinimumPostAuctionLiquidityTierMilestone(previousMilestone)

  useEffect(() => {
    setMilestoneInput(tier.raiseMilestone)
  }, [tier.raiseMilestone])

  const lpTotalText = useMemo(() => {
    const parsedMilestoneInput = parseCompactNumberInput(milestoneInput)
    const percent = tier.percent

    return formatTierLiquidityTotal(
      getPostAuctionLiquidityTierLpDollars(
        {
          raiseMilestone: parsedMilestoneInput !== null ? milestoneInput : tier.raiseMilestone,
          percent,
        },
        previousMilestone,
      ),
      raiseCurrencySymbol,
    )
  }, [milestoneInput, previousMilestone, raiseCurrencySymbol, tier.percent, tier.raiseMilestone])

  return (
    <Flex row alignItems="center" gap="$spacing8">
      <Flex row flex={1} flexBasis={0} minWidth={0} gap="$spacing4">
        <Flex flex={1} flexBasis={0} minWidth={0}>
          <TierField>
            <Text variant="body3" color="$neutral2" flexShrink={0}>
              ≤
            </Text>
            <Input
              unstyled
              value={milestoneInput}
              onChangeText={(value) => {
                if (!isAllowedCompactNumberInput(value)) {
                  return
                }

                setMilestoneInput(value)
                const parsed = parseCompactNumberInput(value)
                if (parsed && parsed >= minimumMilestone) {
                  onUpdateMilestone(value)
                }
              }}
              onBlur={() => {
                const parsed = parseCompactNumberInput(milestoneInput)
                if (!parsed || parsed < minimumMilestone) {
                  setMilestoneInput(tier.raiseMilestone)
                  return
                }
                onUpdateMilestone(milestoneInput)
              }}
              placeholder="100k"
              placeholderTextColor="$neutral3"
              color="$neutral1"
              outlineStyle="none"
              fontSize={14}
              lineHeight={18}
              $platform-web={{
                fieldSizing: 'content',
                minWidth: '1ch',
                maxWidth: '100%',
              }}
            />
            <Text variant="body3" color="$neutral3" flexShrink={0}>
              {raiseCurrencySymbol}
            </Text>
          </TierField>
        </Flex>

        <Flex flex={1} flexBasis={0} minWidth={0}>
          <TierField
            trailing={
              <Text variant="body3" color="$neutral3" flexShrink={0}>
                {lpTotalText}
              </Text>
            }
          >
            <PercentInput percent={tier.percent} onUpdatePercent={onUpdatePercent} />
          </TierField>
        </Flex>
      </Flex>
      <TouchableArea p="$spacing4" onPress={onRemove}>
        <X size="$icon.16" color="$neutral2" />
      </TouchableArea>
    </Flex>
  )
}

function UnboundedTierRow({
  tier,
  previousMilestone,
  raiseCurrencySymbol,
  onUpdatePercent,
}: {
  tier: PostAuctionLiquidityTier
  previousMilestone?: number
  raiseCurrencySymbol: string
  onUpdatePercent: (percent: number) => void
}) {
  const { t } = useTranslation()
  const milestoneLabel = previousMilestone
    ? `> ${formatCompactNumberDisplay(previousMilestone)} ${raiseCurrencySymbol}`
    : t('toucan.createAuction.step.configureAuction.postAuctionLiquidity.noLimit')

  return (
    <Flex row alignItems="center" gap="$spacing8">
      <Flex row flex={1} flexBasis={0} minWidth={0} gap="$spacing4">
        <Flex flex={1} flexBasis={0} minWidth={0}>
          <TierField>
            <Text variant="body3" color="$neutral2" numberOfLines={1}>
              {milestoneLabel}
            </Text>
          </TierField>
        </Flex>

        <Flex flex={1} flexBasis={0} minWidth={0}>
          <TierField>
            <PercentInput percent={tier.percent} onUpdatePercent={onUpdatePercent} />
          </TierField>
        </Flex>
      </Flex>

      <Flex width="$spacing24" height="$spacing24" opacity={0} />
    </Flex>
  )
}

interface PostAuctionLiquidityTieredEditorProps {
  raiseCurrencySymbol: string
  tiers: PostAuctionLiquidityTier[]
  onAddTier: () => void
  onRemoveTier: (tierId: string) => void
  onUpdateTier: (tierId: string, config: Partial<Pick<PostAuctionLiquidityTier, 'raiseMilestone' | 'percent'>>) => void
}

export function PostAuctionLiquidityTieredEditor({
  raiseCurrencySymbol,
  tiers,
  onAddTier,
  onRemoveTier,
  onUpdateTier,
}: PostAuctionLiquidityTieredEditorProps) {
  const { t } = useTranslation()
  const boundedTiers = tiers.filter((tier) => !isUnboundedTier(tier))
  const unboundedTier = tiers.find(isUnboundedTier)
  const canAddTier = tiers.length < MAX_POST_AUCTION_LIQUIDITY_TIERS

  return (
    <Flex gap="$spacing8">
      <Flex row alignItems="center" gap="$spacing8">
        <Flex row flex={1} flexBasis={0} minWidth={0} gap="$spacing4">
          <Flex flex={1} flexBasis={0} minWidth={0}>
            <Text variant="body4" color="$neutral1">
              {t('toucan.createAuction.step.configureAuction.postAuctionLiquidity.raiseMilestone')}
            </Text>
          </Flex>
          <Flex flex={1} flexBasis={0} minWidth={0}>
            <Text variant="body4" color="$neutral1">
              {t(
                'toucan.createAuction.step.configureAuction.postAuctionLiquidity.percentOfRaiseMilestoneToLiquidityPool',
              )}
            </Text>
          </Flex>
        </Flex>
        <Flex width="$spacing24" height="$spacing24" opacity={0} />
      </Flex>

      {boundedTiers.map((tier, index) => (
        <BoundedTierRow
          key={tier.id}
          tier={tier}
          previousMilestone={
            index > 0
              ? (parseCompactNumberInput(boundedTiers[index - 1]?.raiseMilestone ?? '') ?? undefined)
              : undefined
          }
          raiseCurrencySymbol={raiseCurrencySymbol}
          onUpdateMilestone={(raiseMilestone) => onUpdateTier(tier.id, { raiseMilestone })}
          onUpdatePercent={(percent) => onUpdateTier(tier.id, { percent })}
          onRemove={() => onRemoveTier(tier.id)}
        />
      ))}

      {unboundedTier && (
        <UnboundedTierRow
          tier={unboundedTier}
          previousMilestone={
            boundedTiers.length > 0
              ? (parseCompactNumberInput(boundedTiers[boundedTiers.length - 1]?.raiseMilestone ?? '') ?? undefined)
              : undefined
          }
          raiseCurrencySymbol={raiseCurrencySymbol}
          onUpdatePercent={(percent) => onUpdateTier(unboundedTier.id, { percent })}
        />
      )}

      <TouchableArea
        row
        alignItems="center"
        gap="$spacing4"
        px="$spacing4"
        py="$spacing8"
        onPress={onAddTier}
        disabled={!canAddTier}
        opacity={canAddTier ? 1 : 0.5}
      >
        <Plus size="$icon.16" color={canAddTier ? '$neutral2' : '$neutral3'} />
        <Text variant="buttonLabel4" color={canAddTier ? '$neutral2' : '$neutral3'}>
          {t('toucan.createAuction.step.configureAuction.postAuctionLiquidity.addTier')}
        </Text>
      </TouchableArea>
    </Flex>
  )
}
