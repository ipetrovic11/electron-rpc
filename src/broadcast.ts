/**
 * Used only in main process to broadcast message to all windows.
 */

import { BrowserWindow, IpcMainEvent } from 'electron';

/**
 * Broadcast message to all processes(main and browsers)
 * @param message - name of the message.
 * @param payload - payload that is transmitted with message.
 * @param sender(optional) - process or windows that sent the message which will be excluded from broadcast.
 */
export function send(message: string, payload: any, sender?: BrowserWindow | IpcMainEvent): void {

    if (sender && (sender as IpcMainEvent).sender) {
        sender = BrowserWindow.fromWebContents((sender as IpcMainEvent).sender)
    }

    BrowserWindow.getAllWindows().forEach(window => {
        if (window !== sender) {
            window.webContents.send(message, payload);
        }
    });
}
