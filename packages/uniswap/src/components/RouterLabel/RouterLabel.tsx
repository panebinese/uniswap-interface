import { useTranslation } from 'react-i18next'
import { Flex, UniswapXText } from 'ui/src'
import { UniswapX } from 'ui/src/components/icons/UniswapX'
import { useSwapTxStore } from 'uniswap/src/features/transactions/swap/stores/swapTxStore/useSwapTxStore'
import { isClassic, isUniswapX } from 'uniswap/src/features/transactions/swap/utils/routing'

export function RouterLabel(): JSX.Element | null {
  const trade = useSwapTxStore((s) => s.trade)
  const { t } = useTranslation()

  if (!trade) {
    return null
  }

  if (isUniswapX(trade)) {
    return (
      <Flex row alignItems="center">
        <UniswapX size="$icon.16" mr="$spacing2" />
        <UniswapXText variant="body3">{t('uniswapx.label')}</UniswapXText>
      </Flex>
    )
  }

  if (isClassic(trade)) {
    return <>Uniswap API</>
  }

  return null
}
