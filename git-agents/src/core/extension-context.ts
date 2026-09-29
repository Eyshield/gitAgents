export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

export function hasExtensionRuntimeError(): boolean {
  try {
    return Boolean(chrome.runtime?.lastError)
  } catch {
    return true
  }
}
