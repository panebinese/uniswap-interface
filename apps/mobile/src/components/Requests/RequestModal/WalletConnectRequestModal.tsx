import { useNetInfo } from '@react-native-community/netinfo'
import { getSdkError } from '@walletconnect/utils'
import { providers } from 'ethers'
import React, { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { ModalWithOverlay } from 'src/components/Requests/ModalWithOverlay/ModalWithOverlay'
import { ActionCannotBeCompletedContent } from 'src/components/Requests/RequestModal/ActionCannotBeCompletedContent'
import { KidSuperCheckinModal } from 'src/components/Requests/RequestModal/KidSuperCheckinModal'
import { UwULinkErc20SendModal } from 'src/components/Requests/RequestModal/UwULinkErc20SendModal'
import {
  WalletConnectRequestModalContent,
  getDoesMethodCostGas,
} from 'src/components/Requests/RequestModal/WalletConnectRequestModalContent'
import { useHasSufficientFunds } from 'src/components/Requests/RequestModal/hooks'
import { useBiometricAppSettings } from 'src/features/biometrics/useBiometricAppSettings'
import { useBiometricPrompt } from 'src/features/biometricsSettings/hooks'
import { returnToPreviousApp } from 'src/features/walletConnect/WalletConnect'
import { selectDidOpenFromDeepLink } from 'src/features/walletConnect/selectors'
import { signWcRequestActions } from 'src/features/walletConnect/signWcRequestSaga'
import { wcWeb3Wallet } from 'src/features/walletConnect/walletConnectClient'
import {
  WalletConnectSigningRequest,
  isBatchedTransactionRequest,
  isTransactionRequest,
  setDidOpenFromDeepLink,
} from 'src/features/walletConnect/walletConnectSlice'
import { spacing } from 'ui/src/theme'
import { EthMethod } from 'uniswap/src/features/dappRequests/types'
import { isSignTypedDataRequest } from 'uniswap/src/features/dappRequests/utils'
import { useTransactionGasFee } from 'uniswap/src/features/gas/hooks'
import { FeatureFlags } from 'uniswap/src/features/gating/flags'
import { useFeatureFlag } from 'uniswap/src/features/gating/hooks'
import { Platform } from 'uniswap/src/features/platforms/types/Platform'
import { useHasAccountMismatchCallback } from 'uniswap/src/features/smartWallet/mismatch/hooks'
import { MobileEventName, ModalName } from 'uniswap/src/features/telemetry/constants'
import { sendAnalyticsEvent } from 'uniswap/src/features/telemetry/send'
import { useIsBlocked } from 'uniswap/src/features/trm/hooks'
import { DappRequestType, UwULinkMethod, WCEventType, WCRequestOutcome } from 'uniswap/src/types/walletConnect'
import { areAddressesEqual } from 'uniswap/src/utils/addresses'
import { formatExternalTxnWithGasEstimates } from 'wallet/src/features/gas/formatExternalTxnWithGasEstimates'
import { useIsBlockedActiveAddress } from 'wallet/src/features/trm/hooks'
import { useSignerAccounts } from 'wallet/src/features/wallet/hooks'

interface Props {
  onClose: () => void
  request: WalletConnectSigningRequest
}

const VALID_REQUEST_TYPES = [
  EthMethod.PersonalSign,
  EthMethod.SignTypedData,
  EthMethod.SignTypedDataV4,
  EthMethod.EthSign,
  EthMethod.EthSendTransaction,
  UwULinkMethod.Erc20Send,
  EthMethod.WalletSendCalls,
]

export function WalletConnectRequestModal({ onClose, request }: Props): JSX.Element | null {
  const { t } = useTranslation()
  const netInfo = useNetInfo()
  const didOpenFromDeepLink = useSelector(selectDidOpenFromDeepLink)
  const chainId = request.chainId

  const enablePermitMismatchUx = useFeatureFlag(FeatureFlags.EnablePermitMismatchUX)

  const tx: providers.TransactionRequest | undefined = useMemo(() => {
    if (isTransactionRequest(request)) {
      return { ...request.transaction, chainId }
    }
    if (isBatchedTransactionRequest(request)) {
      return { ...request.encodedTransaction, chainId }
    }
    return undefined
  }, [chainId, request])

  const signerAccounts = useSignerAccounts()
  const signerAccount = signerAccounts.find((account) =>
    // TODO(WALL-7065): Update to support solana
    areAddressesEqual({
      addressInput1: { address: account.address, platform: Platform.EVM },
      addressInput2: { address: request.account, platform: Platform.EVM },
    }),
  )
  const gasFee = useTransactionGasFee({ tx })

  const hasSufficientFunds = useHasSufficientFunds({
    account: request.account,
    chainId,
    gasFee,
    value: tx?.value?.toString(),
  })

  const { isBlocked: isSenderBlocked, isBlockedLoading: isSenderBlockedLoading } = useIsBlockedActiveAddress()
  const { isBlocked: isRecipientBlocked, isBlockedLoading: isRecipientBlockedLoading } = useIsBlocked(tx?.to)

  const isBlocked = isSenderBlocked || isRecipientBlocked
  const isBlockedLoading = isSenderBlockedLoading || isRecipientBlockedLoading

  const getHasMismatch = useHasAccountMismatchCallback()
  const hasMismatch = getHasMismatch(chainId)
  // When link mode is active we can sign messages through universal links on device
  const suppressOfflineWarning = request.isLinkModeSupported

  const checkConfirmEnabled = (): boolean => {
    if (!netInfo.isInternetReachable && !suppressOfflineWarning) {
      return false
    }

    if (!signerAccount) {
      return false
    }

    if (isBlocked || isBlockedLoading) {
      return false
    }

    if (getDoesMethodCostGas(request)) {
      return !!(tx && hasSufficientFunds && gasFee.value && !gasFee.error && !gasFee.isLoading)
    }

    if (isTransactionRequest(request)) {
      return !!tx
    }

    return true
  }

  const confirmEnabled = checkConfirmEnabled()
  const dispatch = useDispatch()
  /**
   * TODO: [MOB-239] implement this behavior in a less janky way. Ideally if we can distinguish between `onClose` being called programmatically and `onClose` as a results of a user dismissing the modal then we can determine what this value should be without this class variable.
   * Indicates that the modal can reject the request when the modal happens. This will be false when the modal closes as a result of the user explicitly confirming or rejecting a request and true otherwise.
   */
  const rejectOnCloseRef = useRef(true)

  const onReject = async (): Promise<void> => {
    if (request.dappRequestInfo.requestType === DappRequestType.WalletConnectSessionRequest) {
      await wcWeb3Wallet.respondSessionRequest({
        topic: request.sessionId,
        response: {
          id: Number(request.internalId),
          jsonrpc: '2.0',
          error: getSdkError('USER_REJECTED'),
        },
      })
    }

    rejectOnCloseRef.current = false

    sendAnalyticsEvent(MobileEventName.WalletConnectSheetCompleted, {
      request_type: isTransactionRequest(request) ? WCEventType.TransactionRequest : WCEventType.SignRequest,
      eth_method: request.type,
      dapp_url: request.dappRequestInfo.url,
      dapp_name: request.dappRequestInfo.name,
      wc_version: '2',
      chain_id: chainId,
      outcome: WCRequestOutcome.Reject,
    })

    onClose()
    if (didOpenFromDeepLink) {
      await returnToPreviousApp()
      setDidOpenFromDeepLink(false)
    }
  }

  const onConfirm = async (): Promise<void> => {
    if (!confirmEnabled || !signerAccount) {
      return
    }

    if (
      request.type === EthMethod.EthSendTransaction ||
      request.type === UwULinkMethod.Erc20Send ||
      request.type === EthMethod.WalletSendCalls
    ) {
      if (!tx) {
        return
      }
      const txnWithFormattedGasEstimates = formatExternalTxnWithGasEstimates({
        transaction: tx,
        gasFeeResult: gasFee,
      })

      dispatch(
        signWcRequestActions.trigger({
          sessionId: request.sessionId,
          requestInternalId: request.internalId,
          method: request.type === EthMethod.WalletSendCalls ? EthMethod.WalletSendCalls : EthMethod.EthSendTransaction,
          transaction: txnWithFormattedGasEstimates,
          account: signerAccount,
          dappRequestInfo: request.dappRequestInfo,
          chainId,
          request,
        }),
      )
    } else {
      dispatch(
        signWcRequestActions.trigger({
          sessionId: request.sessionId,
          requestInternalId: request.internalId,
          // this is EthSignMessage type
          method: request.type,
          message: request.message || request.rawMessage,
          account: signerAccount,
          dappRequestInfo: request.dappRequestInfo,
          chainId,
        }),
      )
    }

    rejectOnCloseRef.current = false

    sendAnalyticsEvent(MobileEventName.WalletConnectSheetCompleted, {
      request_type: isTransactionRequest(request) ? WCEventType.TransactionRequest : WCEventType.SignRequest,
      eth_method: request.type,
      dapp_url: request.dappRequestInfo.url,
      dapp_name: request.dappRequestInfo.name,
      wc_version: '2',
      chain_id: chainId,
      outcome: WCRequestOutcome.Confirm,
    })

    onClose()
    if (didOpenFromDeepLink) {
      await returnToPreviousApp()
      setDidOpenFromDeepLink(false)
    }
  }

  const { trigger: actionButtonTrigger } = useBiometricPrompt(onConfirm)
  const { requiredForTransactions } = useBiometricAppSettings()

  const onConfirmPress = async (): Promise<void> => {
    if (requiredForTransactions) {
      await actionButtonTrigger()
    } else {
      await onConfirm()
    }
  }

  if (!VALID_REQUEST_TYPES.includes(request.type)) {
    return null
  }

  const handleClose = async (): Promise<void> => {
    if (rejectOnCloseRef.current) {
      await onReject()
    } else {
      onClose()
    }
  }

  if (request.type === UwULinkMethod.Erc20Send) {
    return (
      <UwULinkErc20SendModal
        confirmEnabled={confirmEnabled}
        gasFee={gasFee}
        hasSufficientGasFunds={hasSufficientFunds}
        request={request}
        onClose={handleClose}
        onConfirm={onConfirmPress}
        onReject={onReject}
      />
    )
  }

  if (enablePermitMismatchUx && hasMismatch && isSignTypedDataRequest(request)) {
    return <ActionCannotBeCompletedContent request={request} onReject={onReject} />
  }

  // KidSuper Uniswap Cafe check-in screen
  if (request.type === EthMethod.PersonalSign && request.dappRequestInfo.name === 'Uniswap Cafe') {
    return (
      <KidSuperCheckinModal request={request} onClose={handleClose} onConfirm={onConfirmPress} onReject={onReject} />
    )
  }

  return (
    <ModalWithOverlay
      confirmationButtonText={
        isTransactionRequest(request) || isBatchedTransactionRequest(request)
          ? t('common.button.accept')
          : t('walletConnect.request.button.sign')
      }
      disableConfirm={!confirmEnabled}
      name={ModalName.WCSignRequest}
      scrollDownButtonText={t('walletConnect.request.button.scrollDown')}
      contentContainerStyle={{
        paddingHorizontal: spacing.none,
        paddingTop: spacing.spacing12,
      }}
      onClose={handleClose}
      onConfirm={onConfirmPress}
      onReject={onReject}
    >
      <WalletConnectRequestModalContent
        gasFee={gasFee}
        hasSufficientFunds={hasSufficientFunds}
        isBlocked={isBlocked}
        request={request}
      />
    </ModalWithOverlay>
  )
}
