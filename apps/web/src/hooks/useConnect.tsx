import { useAccountDrawer } from 'components/AccountDrawer/MiniPortfolio/hooks'
import { walletTypeToAmplitudeWalletType } from 'components/Web3Provider/walletConnect'
import { PropsWithChildren, createContext, useContext } from 'react'
import { useLocation } from 'react-router'
import { CONNECTION_PROVIDER_IDS } from 'uniswap/src/constants/web3'
import { InterfaceEventName } from 'uniswap/src/features/telemetry/constants'
import { sendAnalyticsEvent } from 'uniswap/src/features/telemetry/send'
import { WalletConnectionResult } from 'uniswap/src/features/telemetry/types'
import { logger } from 'utilities/src/logger/logger'
import { getCurrentPageFromLocation } from 'utils/urlRoutes'
import { UserRejectedRequestError } from 'viem'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ResolvedRegister, UseConnectReturnType, useConnect as useConnectWagmi } from 'wagmi'

const ConnectionContext = createContext<UseConnectReturnType<ResolvedRegister['config']> | undefined>(undefined)

export function ConnectionProvider({ children }: PropsWithChildren) {
  const { pathname } = useLocation()
  const accountDrawer = useAccountDrawer()

  const connection = useConnectWagmi({
    mutation: {
      onMutate({ connector }) {
        logger.debug('useConnect', 'ConnectionProvider', `Connection activating: ${connector.name}`)
      },
      onSuccess(_, { connector }) {
        logger.debug('useConnect', 'ConnectionProvider', `Connection activated: ${connector.name}`)
        if ('id' in connector && connector.id === CONNECTION_PROVIDER_IDS.EMBEDDED_WALLET_CONNECTOR_ID) {
          accountDrawer.open()
        } else {
          accountDrawer.close()
        }
      },
      onError(error, { connector }) {
        if (error instanceof UserRejectedRequestError) {
          connection.reset()
          return
        }

        // TODO(WEB-1859): re-add special treatment for already-pending injected errors & move debug to after didUserReject() check
        logger.warn('useConnect', 'ConnectionProvider', `Connection failed: ${connector.name}`)

        sendAnalyticsEvent(InterfaceEventName.WalletConnected, {
          result: WalletConnectionResult.Failed,
          wallet_name: connector.name,
          wallet_type: walletTypeToAmplitudeWalletType('type' in connector ? connector.type : undefined),
          page: getCurrentPageFromLocation(pathname),
          error: error.message,
        })
      },
    },
  })

  return <ConnectionContext.Provider value={connection}>{children}</ConnectionContext.Provider>
}

/**
 * Wraps wagmi.useConnect in a singleton provider to provide the same connect state to all callers.
 * @see {@link https://wagmi.sh/react/api/hooks/useConnect}
 */
export function useConnect(): UseConnectReturnType<ResolvedRegister['config']> {
  const value = useContext(ConnectionContext)
  if (!value) {
    throw new Error('useConnect must be used within a ConnectionProvider')
  }
  return value
}
