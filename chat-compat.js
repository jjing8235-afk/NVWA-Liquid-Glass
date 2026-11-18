// These markers are set and removed by ST-BaiBai-Tools' long-chat renderer.
// Observe active DOM ownership, not plugin installation or private settings.
export const externalMessageRendering = chat => chat.classList.contains('bai-bai-toolkit-long-chat-render-optimized');
export const externalScrollControl = chat => externalMessageRendering(chat)
    || chat.classList.contains('bai-bai-toolkit-long-chat-bottom-anchored');
