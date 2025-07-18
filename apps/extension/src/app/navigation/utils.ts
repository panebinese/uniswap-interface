import { To, useLocation } from 'react-router'
import { TopLevelRoutes, UnitagClaimRoutes } from 'src/app/navigation/constants'
import { navigate } from 'src/app/navigation/state'
import { onboardingMessageChannel } from 'src/background/messagePassing/messageChannels'
import { OnboardingMessageType } from 'src/background/messagePassing/types/ExtensionMessages'
import { uniswapUrls } from 'uniswap/src/constants/urls'
import { TransactionState } from 'uniswap/src/features/transactions/types/transactionState'
import { logger } from 'utilities/src/logger/logger'
import { escapeRegExp } from 'utilities/src/primitives/string'
import { getTokenUrl } from 'wallet/src/utils/linking'

export type SidebarLocationState =
  | {
      initialTransactionState?: TransactionState
    }
  | undefined

export const useExtensionNavigation = (): {
  navigateTo: (path: To) => void
  navigateBack: () => void
  locationState: SidebarLocationState
} => {
  const navigateTo = (path: To): void => navigate(path)
  const navigateBack = (): void => navigate(-1)
  const locationState = useLocation().state as SidebarLocationState

  return { navigateTo, navigateBack, locationState }
}

export async function focusOrCreateOnboardingTab(page?: string): Promise<void> {
  const extension = await chrome.management.getSelf()

  const tabs = await chrome.tabs.query({ url: `chrome-extension://${extension.id}/onboarding.html*` })
  const tab = tabs[0]

  const url = 'onboarding.html#/' + (page ? page : TopLevelRoutes.Onboarding)

  if (!tab?.id) {
    await chrome.tabs.create({ url })
    return
  }

  await chrome.tabs.update(tab.id, {
    active: true,
    highlighted: true,
    // We only want to update the URL if we're navigating to a specific page.
    // Otherwise, just focus the existing tab without overriding the current URL.
    url: page ? url : undefined,
  })

  if (page) {
    // When navigating to a specific page, we need to reload the tab to ensure that the app state is reset and the store synchronization is properly initialized.
    // This is necessary to handle the edge case where the user leaves a completed onboarding tab open (with synchronization paused)
    // and then clicks on the "forgot password" link.
    await chrome.tabs.reload(tab.id)
  }

  await chrome.windows.update(tab.windowId, { focused: true })

  await onboardingMessageChannel.sendMessage({
    type: OnboardingMessageType.HighlightOnboardingTab,
  })
}

export async function focusOrCreateUnitagTab(address: Address, page: UnitagClaimRoutes): Promise<void> {
  const extension = await chrome.management.getSelf()

  const tabs = await chrome.tabs.query({ url: `chrome-extension://${extension.id}/unitagClaim.html*` })
  const tab = tabs[0]

  const url = `unitagClaim.html#/${page}?address=${address}`

  if (!tab?.id) {
    await chrome.tabs.create({ url })
    return
  }

  await chrome.tabs.update(tab.id, {
    active: true,
    highlighted: true,
    url,
  })

  await chrome.windows.update(tab.windowId, { focused: true })
}

export async function focusOrCreateDappRequestWindow(tabId: number | undefined, windowId: number): Promise<void> {
  const extension = await chrome.management.getSelf()

  const tabs = await chrome.tabs.query({ url: `chrome-extension://${extension.id}/popup.html*` })
  const tab = tabs[0]

  const height = 410
  const width = 330

  const { left, top } = await calculatePopupWindowPosition({ width, height })

  let url = `popup.html?windowId=${windowId}`
  if (tabId) {
    url += `&tabId=${tabId}`
  }

  if (!tab?.id) {
    await chrome.windows.create({
      url,
      type: 'popup',
      top,
      left,
      width,
      height,
    })
    return
  }

  await chrome.tabs.update(tab.id, {
    url,
    active: true,
    highlighted: true,
  })
  await chrome.windows.update(tab.windowId, { focused: true, top, left, width, height })
}

/**
 * To avoid opening too many tabs while also ensuring that we don't take over the user's active tab,
 * we only update the URL of the active tab if it's already in a specific route of the Uniswap interface.
 *
 * If the current tab is not in that route, we open a new tab instead.
 */
export async function focusOrCreateUniswapInterfaceTab({
  url,
  reuseActiveTabIfItMatches,
}: {
  url: string
  reuseActiveTabIfItMatches?: RegExp
}): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })

  const activeTab = tabs[0]
  const activeTabUrl = activeTab?.url

  const isInNewTabPage = activeTabUrl === 'chrome://newtab/'

  const shouldReuseActiveTab = reuseActiveTabIfItMatches
    ? activeTabUrl && reuseActiveTabIfItMatches.test(activeTabUrl)
    : false

  if (activeTab?.id && (shouldReuseActiveTab || isInNewTabPage)) {
    await chrome.tabs.update(activeTab.id, {
      active: true,
      highlighted: true,
      url,
    })
    return
  }

  await chrome.tabs.create({ url })
}

export async function focusOrCreateTokensExploreTab({ currencyId }: { currencyId: string }): Promise<void> {
  const url = getTokenUrl(currencyId)

  if (!url) {
    logger.error(new Error('Failed to get token URL'), {
      tags: { file: 'navigation/utils.ts', function: 'focusOrCreateTokensExploreTab' },
      extra: { currencyId },
    })
    return undefined
  }

  return focusOrCreateUniswapInterfaceTab({
    url,
    // We want to reuse the active tab only if it's already in any other TDP.
    // eslint-disable-next-line security/detect-non-literal-regexp
    reuseActiveTabIfItMatches: new RegExp(`^${escapeRegExp(uniswapUrls.webInterfaceTokensUrl)}`),
  })
}

export async function getCurrentTabAndWindowId(): Promise<{ tabId: number; windowId: number }> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tabs.length === 0 || !tabs[0] || typeof tabs[0].id !== 'number' || typeof tabs[0].windowId !== 'number') {
    throw new Error('No active tab found or missing tab/window ID')
  }
  return { tabId: tabs[0].id, windowId: tabs[0].windowId }
}

export async function closeCurrentTab(): Promise<void> {
  try {
    const tab = await chrome.tabs.getCurrent()

    if (tab?.id) {
      await chrome.tabs.remove(tab.id)
    } else {
      throw new Error('chrome.tabs.getCurrent did not return a tab with an id')
    }
  } catch (e) {
    logger.error(e, {
      tags: {
        file: 'utils.ts',
        function: 'closeCurrentTab',
      },
    })
  }
}

/**
 * Calculates the top and left position of a centered pop up window,
 * making sure it's on the same monitor as the current window.
 */
async function calculatePopupWindowPosition({
  width,
  height,
}: {
  width: number
  height: number
}): Promise<{ left: number; top: number }> {
  const currentWindow = await chrome.windows.getCurrent()
  const currentWindowLeft = currentWindow.left ?? 0
  const currentWindowTop = currentWindow.top ?? 0
  const currentWindowWidth = currentWindow.width ?? width
  const currentWindowHeight = currentWindow.height ?? height

  return {
    left: Math.round(currentWindowLeft + (currentWindowWidth - width) / 2),
    top: Math.round(currentWindowTop + (currentWindowHeight - height) / 2),
  }
}

/**
 * Opens a popup window centered on the current window, making sure it's on the same monitor.
 */
export async function openPopupWindow({
  url,
  width,
  height,
}: {
  url: string
  width: number
  height: number
}): Promise<chrome.windows.Window> {
  const { left, top } = await calculatePopupWindowPosition({ width, height })

  const popupWindow = await chrome.windows.create({
    url,
    type: 'popup',
    width,
    height,
    left,
    top,
  })

  return popupWindow
}

export function closeWindow(window: chrome.windows.Window | undefined): void {
  if (!window?.id) {
    return
  }

  chrome.windows.remove(window.id).catch((error) => {
    logger.error(error, {
      tags: {
        file: 'navigation/utils.ts',
        function: 'closeWindow',
      },
    })
  })
}

export async function bringWindowToFront(windowId: number, options?: { centered?: boolean }): Promise<void> {
  if (options?.centered) {
    const window = await chrome.windows.get(windowId)
    const { left, top } = await calculatePopupWindowPosition({ width: window.width ?? 0, height: window.height ?? 0 })
    await chrome.windows.update(windowId, { left, top })
  }

  await chrome.windows.update(windowId, { focused: true })
}
