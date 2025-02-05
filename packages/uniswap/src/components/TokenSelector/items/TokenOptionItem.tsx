import React, { useCallback, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Flex, Text, TouchableArea, useSporeColors } from 'ui/src'
import Check from 'ui/src/assets/icons/check.svg'
import { UnichainAnimatedText } from 'ui/src/components/text/UnichainAnimatedText'
import { iconSizes } from 'ui/src/theme'
import { TokenLogo } from 'uniswap/src/components/CurrencyLogo/TokenLogo'
import { TokenOption } from 'uniswap/src/components/TokenSelector/types'
import { WarningSeverity } from 'uniswap/src/components/modals/WarningModal/types'
import WarningIcon from 'uniswap/src/components/warnings/WarningIcon'
import { getWarningIconColors } from 'uniswap/src/components/warnings/utils'
import { SafetyLevel } from 'uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks'
import { setHasSeenBridgingTooltip } from 'uniswap/src/features/behaviorHistory/slice'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import TokenWarningModal from 'uniswap/src/features/tokens/TokenWarningModal'
import { getTokenWarningSeverity } from 'uniswap/src/features/tokens/safetyUtils'
import { useUnichainTooltipVisibility } from 'uniswap/src/features/unichain/hooks/useUnichainTooltipVisibility'
import { getSymbolDisplayText } from 'uniswap/src/utils/currency'
import { shortenAddress } from 'utilities/src/addresses'
import { dismissNativeKeyboard } from 'utilities/src/device/keyboard'
import { isInterface } from 'utilities/src/platform'

interface OptionProps {
  option: TokenOption
  showWarnings: boolean
  onPress: () => void
  showTokenAddress?: boolean
  tokenWarningDismissed: boolean
  quantity: number | null
  // TODO(WEB-4731): Remove isKeyboardOpen dependency
  isKeyboardOpen?: boolean
  // TODO(WEB-3643): Share localization context with WEB
  // (balance, quantityFormatted)
  balance: string
  quantityFormatted?: string
  isSelected?: boolean
}

function _TokenOptionItem({
  option,
  showWarnings,
  onPress,
  showTokenAddress,
  tokenWarningDismissed,
  balance,
  quantity,
  quantityFormatted,
  isKeyboardOpen,
  isSelected,
}: OptionProps): JSX.Element {
  const { currencyInfo, isUnsupported } = option
  const { currency, safetyLevel } = currencyInfo
  const [showWarningModal, setShowWarningModal] = useState(false)
  const colors = useSporeColors()
  const dispatch = useDispatch()

  const severity = getTokenWarningSeverity(currencyInfo)
  const isBlocked = severity === WarningSeverity.Blocked || safetyLevel === SafetyLevel.Blocked
  // in token selector, we only show the warning icon if token is >=Medium severity
  const { colorSecondary: warningIconColor } = getWarningIconColors(severity)
  const shouldShowWarningModalOnPress = isBlocked || (severity !== WarningSeverity.None && !tokenWarningDismissed)

  const { shouldShowUnichainBridgingTooltip } = useUnichainTooltipVisibility()
  const isUnichainEth = currency.isNative && currency.chainId === UniverseChainId.Unichain
  const showUnichainPromoAnimation = shouldShowUnichainBridgingTooltip && isUnichainEth

  const handleShowWarningModal = useCallback((): void => {
    dismissNativeKeyboard()
    setShowWarningModal(true)
  }, [setShowWarningModal])

  const onPressTokenOption = useCallback(() => {
    dispatch(setHasSeenBridgingTooltip(true))
    if (showWarnings && shouldShowWarningModalOnPress) {
      // On mobile web we need to wait for the keyboard to hide
      // before showing the modal to avoid height issues
      if (isKeyboardOpen && isInterface) {
        const activeElement = document.activeElement as HTMLElement | null
        activeElement?.blur()
        setTimeout(handleShowWarningModal, 700)
      } else {
        handleShowWarningModal()
      }
      return
    }

    onPress()
  }, [dispatch, showWarnings, shouldShowWarningModalOnPress, onPress, isKeyboardOpen, handleShowWarningModal])

  const onAcceptTokenWarning = useCallback(() => {
    setShowWarningModal(false)
    onPress()
  }, [onPress])

  return (
    <>
      <TouchableArea
        animation="300ms"
        hoverStyle={{ backgroundColor: '$surface1Hovered' }}
        opacity={(showWarnings && severity === WarningSeverity.Blocked) || isUnsupported ? 0.5 : 1}
        width="100%"
        onPress={onPressTokenOption}
      >
        <Flex
          row
          alignItems="center"
          gap="$spacing8"
          justifyContent="space-between"
          px="$spacing16"
          py="$spacing12"
          style={{
            pointerEvents: 'auto',
          }}
          testID={`token-option-${currency.chainId}-${currency.symbol}`}
        >
          <Flex row shrink alignItems="center" gap="$spacing12">
            <TokenLogo
              chainId={currency.chainId}
              name={currency.name}
              symbol={currency.symbol}
              url={currencyInfo.logoUrl ?? undefined}
            />
            <Flex shrink>
              <Flex row alignItems="center" gap="$spacing8">
                <UnichainAnimatedText
                  color="$neutral1"
                  gradientTextColor={colors.neutral1.val}
                  delayMs={800}
                  enabled={showUnichainPromoAnimation}
                  numberOfLines={1}
                  variant="body1"
                >
                  {currency.name}
                </UnichainAnimatedText>
                {warningIconColor && (
                  <Flex>
                    <WarningIcon severity={severity} size="$icon.16" strokeColorOverride={warningIconColor} />
                  </Flex>
                )}
              </Flex>
              <Flex row alignItems="center" gap="$spacing8">
                <Text color="$neutral2" numberOfLines={1} variant="body3">
                  {getSymbolDisplayText(currency.symbol)}
                </Text>
                {!currency.isNative && showTokenAddress && (
                  <Flex shrink>
                    <Text color="$neutral3" numberOfLines={1} variant="body3">
                      {shortenAddress(currency.address)}
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Flex>
          </Flex>

          {isSelected && (
            <Flex grow alignItems="flex-end" justifyContent="center">
              <Check color={colors.accent1.get()} height={iconSizes.icon20} width={iconSizes.icon20} />
            </Flex>
          )}

          {!isSelected && quantity && quantity !== 0 ? (
            <Flex alignItems="flex-end">
              <Text variant="body1">{balance}</Text>
              {quantityFormatted && (
                <Text color="$neutral2" variant="body3">
                  {quantityFormatted}
                </Text>
              )}
            </Flex>
          ) : null}
        </Flex>
      </TouchableArea>

      <TokenWarningModal
        currencyInfo0={currencyInfo}
        isVisible={showWarningModal}
        closeModalOnly={(): void => setShowWarningModal(false)}
        onAcknowledge={onAcceptTokenWarning}
      />
    </>
  )
}

export const TokenOptionItem = React.memo(_TokenOptionItem)
