import { TransactionRequest } from '@ethersproject/providers'
import { Currency } from '@uniswap/sdk-core'
import { providers } from 'ethers'
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ParsedWarnings, WarningAction } from 'uniswap/src/components/modals/WarningModal/types'
import { getNativeAddress } from 'uniswap/src/constants/addresses'
import { AssetType } from 'uniswap/src/entities/assets'
import { useEnabledChains } from 'uniswap/src/features/chains/hooks/useEnabledChains'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { useTransactionGasFee, useTransactionGasWarning } from 'uniswap/src/features/gas/hooks'
import { GasFeeResult } from 'uniswap/src/features/gas/types'
import { useMaxAmountSpend } from 'uniswap/src/features/gas/useMaxAmountSpend'
import { Platform } from 'uniswap/src/features/platforms/types/Platform'
import { useFormattedWarnings } from 'uniswap/src/features/transactions/hooks/useParsedTransactionWarnings'
import { TransactionType } from 'uniswap/src/features/transactions/types/transactionDetails'
import { TransactionState } from 'uniswap/src/features/transactions/types/transactionState'
import { AccountDetails } from 'uniswap/src/features/wallet/types/AccountDetails'
import { CurrencyField } from 'uniswap/src/types/currency'
import { currencyAddress } from 'uniswap/src/utils/currencyId'
import { ensure0xHex } from 'uniswap/src/utils/hex'
import { useDerivedSendInfo } from 'wallet/src/features/transactions/send/hooks/useDerivedSendInfo'
import { useSendTransactionRequest } from 'wallet/src/features/transactions/send/hooks/useSendTransactionRequest'
import { useSendWarnings } from 'wallet/src/features/transactions/send/hooks/useSendWarnings'
import { useActiveAccountWithThrow } from 'wallet/src/features/wallet/hooks'
import { getUniswapWalletMeta } from 'wallet/src/features/wallet/providers/NativeWalletProvider'

export const getDefaultSendState = (defaultChainId: UniverseChainId): Readonly<TransactionState> => ({
  [CurrencyField.INPUT]: {
    address: getNativeAddress(defaultChainId),
    chainId: defaultChainId,
    type: AssetType.Currency,
  },
  [CurrencyField.OUTPUT]: null,
  exactCurrencyField: CurrencyField.INPUT,
  focusOnCurrencyField: CurrencyField.INPUT,
  exactAmountToken: '',
  exactAmountFiat: '',
  isFiatInput: false,
  selectingCurrencyField: undefined,
  showRecipientSelector: true,
  customSlippageTolerance: undefined,
  isMax: false,
})

type SendContextState = {
  derivedSendInfo: ReturnType<typeof useDerivedSendInfo>
  gasFee: GasFeeResult
  warnings: ParsedWarnings
  txRequest: TransactionRequest | undefined
  onSelectCurrency: ({ currency }: { currency: Currency }) => void
  updateSendForm: (newState: Partial<TransactionState>) => void
} & TransactionState

export const SendContext = createContext<SendContextState | undefined>(undefined)

export function SendContextProvider({
  prefilledTransactionState,
  children,
}: {
  prefilledTransactionState?: TransactionState
  children: ReactNode
}): JSX.Element {
  const { t } = useTranslation()
  const account = useActiveAccountWithThrow()
  const { defaultChainId } = useEnabledChains()
  const defaultSendState = getDefaultSendState(defaultChainId)

  // state
  const [sendForm, setSendForm] = useState<TransactionState>(prefilledTransactionState || defaultSendState)

  // derived info based on transfer state
  const derivedSendInfo = useDerivedSendInfo(sendForm)
  const maxInputAmount = useMaxAmountSpend({
    currencyAmount: derivedSendInfo.currencyBalances[CurrencyField.INPUT],
    txType: TransactionType.Send,
    isExtraTx: true,
  })?.toExact()

  const updateSendForm = useCallback(
    (passedNewState: Parameters<SendContextState['updateSendForm']>[0]): void => {
      const newState = { ...passedNewState }
      const isAmountSet = (newState.isFiatInput ? newState.exactAmountFiat : newState.exactAmountToken) !== undefined

      if (isAmountSet) {
        // for explicit "max" actions (eg max button clicked)
        const isExplicitMax = !!newState.isMax

        const isMaxTokenAmount =
          maxInputAmount && newState.exactAmountToken
            ? parseFloat(maxInputAmount) <= parseFloat(newState.exactAmountToken)
            : isExplicitMax

        newState.isMax = isMaxTokenAmount
      }

      setSendForm((prevState) => ({ ...prevState, ...newState }))
    },
    [setSendForm, maxInputAmount],
  )

  const warnings = useSendWarnings(t, derivedSendInfo)
  const { data: txRequest } = useSendTransactionRequest(derivedSendInfo)
  const gasFee = useTransactionGasFee({
    tx: txRequest ?? undefined,
    skip: warnings.some((warning) => warning.action === WarningAction.DisableReview),
    shouldUsePreviousValueDuringLoading: true,
  })
  const txRequestWithGasSettings = useMemo(
    (): providers.TransactionRequest => ({ ...txRequest, ...gasFee.params }),
    [gasFee.params, txRequest],
  )

  const accountDetails: AccountDetails = {
    platform: Platform.EVM,
    accountType: account.type,
    address: ensure0xHex(account.address),
    walletMeta: getUniswapWalletMeta(), // temporarily building accountDetails until we implement new WalletService changes in packages/wallet
  }
  const gasWarning = useTransactionGasWarning({
    account: accountDetails,
    derivedInfo: derivedSendInfo,
    gasFee: gasFee.value,
  })
  const allSendWarnings = useMemo(() => {
    return !gasWarning ? warnings : [...warnings, gasWarning]
  }, [warnings, gasWarning])
  const parsedSendWarnings = useFormattedWarnings(allSendWarnings)

  // helper function for currency selection
  const onSelectCurrency = useCallback(
    ({ currency }: { currency: Currency }) => {
      updateSendForm({
        [CurrencyField.INPUT]: {
          address: currencyAddress(currency),
          chainId: currency.chainId,
          type: AssetType.Currency,
        },
        exactAmountToken: '',
        exactAmountFiat: '',
        selectingCurrencyField: undefined,
      })
    },
    [updateSendForm],
  )

  const state: SendContextState = useMemo(() => {
    return {
      derivedSendInfo,
      gasFee,
      warnings: parsedSendWarnings,
      txRequest: txRequestWithGasSettings,
      onSelectCurrency,
      updateSendForm,
      txId: sendForm.txId,
      [CurrencyField.INPUT]: sendForm.input,
      [CurrencyField.OUTPUT]: sendForm.output,
      exactAmountToken: sendForm.exactAmountToken,
      exactAmountFiat: sendForm.exactAmountFiat,
      exactCurrencyField: sendForm.exactCurrencyField,
      focusOnCurrencyField: sendForm.focusOnCurrencyField,
      isMax: sendForm.isMax,
      recipient: sendForm.recipient,
      isFiatInput: sendForm.isFiatInput,
      selectingCurrencyField: sendForm.selectingCurrencyField,
      showRecipientSelector: sendForm.showRecipientSelector,
      selectedProtocols: sendForm.selectedProtocols,
      customSlippageTolerance: sendForm.customSlippageTolerance,
      fiatOffRampMetaData: sendForm.fiatOffRampMetaData,
    }
  }, [
    derivedSendInfo,
    gasFee,
    parsedSendWarnings,
    txRequestWithGasSettings,
    onSelectCurrency,
    updateSendForm,
    sendForm.txId,
    sendForm.input,
    sendForm.output,
    sendForm.exactAmountToken,
    sendForm.exactAmountFiat,
    sendForm.exactCurrencyField,
    sendForm.focusOnCurrencyField,
    sendForm.recipient,
    sendForm.isFiatInput,
    sendForm.isMax,
    sendForm.selectingCurrencyField,
    sendForm.showRecipientSelector,
    sendForm.customSlippageTolerance,
    sendForm.selectedProtocols,
    sendForm.fiatOffRampMetaData,
  ])
  return <SendContext.Provider value={state}>{children}</SendContext.Provider>
}

export const useSendContext = (): SendContextState => {
  const sendContext = useContext(SendContext)

  if (sendContext === undefined) {
    throw new Error('`useSendContext` must be used inside of `SendContextProvider`')
  }

  return sendContext
}
