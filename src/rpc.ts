import * as uuid from 'uuid';
import * as broadcast from './broadcast';

import { NgZone } from '@angular/core';
import { ipcMain, ipcRenderer, IpcMain, IpcRenderer } from 'electron';

const handlers = {};
const events = {};
const promises = {};
const executions = {};

export enum ProcessType {
    Main = 'browser',
    Window = 'renderer',
    Worker = 'worker'
}
export const type: ProcessType = process.type as ProcessType;
const ipc: IpcMain | IpcRenderer = type === ProcessType.Main ? ipcMain : ipcRenderer;

export function init(zone?: NgZone) {

    if (!zone) {
        zone = {
            run: (fn: (...args: any[]) => any) => {
                fn();
            }
        } as NgZone;
    }

    ipc.on('workpuls::rpc:response', (event, payload) => {

        const { id, data, error } = payload;
        if (promises[id]) {

            zone.run(() => {
                if (error) {
                    promises[id].reject(error);
                } else {
                    promises[id].resolve(data);
                }

                delete promises[id];
            });

        } else if (type === ProcessType.Main) {
            broadcast.send(`workpuls::rpc:response`, payload, event);
        }

    });

    ipc.on('workpuls::rpc:call', async (event, payload) => {

        const { id, name, data } = payload;
        if (handlers[name]) {

            if (executions[id]) {
                return;
            }

            const response = {
                id,
                data: null,
                error: null
            };

            executions[id] = true;

            zone.run(async () => {
                try {
                    response.data = await handlers[name](data);
                } catch (error) {
                    response.error = error;
                }

                try{
                    event.sender.send('workpuls::rpc:response', response);
                }catch(error){ }

                if (executions[id]) {
                    delete executions[id];
                }
            });
        } else if (type === ProcessType.Main) {
            broadcast.send(`workpuls::rpc:call`, payload, event);
        }
    });

    ipc.on('workpuls::rpc:event', async (event, payload) => {

        const { name, data } = payload;
        if (events[name]) {
            zone.run(() => {
                events[name](data);
            });
        }

        if (type === ProcessType.Main) {
            broadcast.send(`workpuls::rpc:event`, payload, event);
        }

    });
}


/**
 * Make a call in remote process, window or main process.
 * @param name - name of the action.
 * @param data - any payload that you would like to transport.
 * @param timeout - after how many ms function will timout, default: 2500.
 * @param retry - The number of attempts to make one call (for the duration of the timeout) before the request is actually rejected due to the timeout. Timeout = timeout * (retry + 1)
 */
export function call(name: string, data?: any, timeout: number = 2500, retry = 0): Promise<any> {

    return new Promise((resolve, reject) => {
        let attempt = 1;
        const id = uuid.v4();
        promises[id] = { resolve, reject };

        const payload = { id, name, data };

        if (type === ProcessType.Main) {
            broadcast.send(`workpuls::rpc:call`, payload);
        } else {
            ipcRenderer.send(`workpuls::rpc:call`, payload);
        }

        const interval = setInterval(() => {

            if (!promises[id]) {
                clearInterval(interval);
                return;
            }

            if (attempt <= retry) {
                /* With each new attempt, we will send a message again in case the previous one was not received for some reason. */
                if (type === ProcessType.Main) {
                    broadcast.send(`workpuls::rpc:call`, payload);
                } else {
                    ipcRenderer.send(`workpuls::rpc:call`, payload);
                }

                attempt++;
                return;
            }

            clearInterval(interval);
            delete promises[id];
            reject(new Error('Timeout'));
        }, timeout);
    });
}

/**
 * Emmit event for all remote processes, windows and main process.
 * @param name - name of the emitted event.
 * @param data - any payload that you would like to transport.
 */
export function emit(name: string, data: any): void {

    const payoad = { name, data };

    if (type === ProcessType.Main) {
        broadcast.send(`workpuls::rpc:event`, payoad);
    } else {
        ipcRenderer.send(`workpuls::rpc:event`, payoad);
    }
}

/**
 * Subscribe to event.
 * @param name - name of the event.
 * @param handler - function executed when event is triggered.
 */
export function on(name: string, handler: (data: any) => any): (data: any) => any {
    events[name] = handler;
    return handler;
}

/**
 * Handle remote procedure call.
 * @param name - name of remote procedure.
 * @param handler -  function executed when call is triggered.
 */
export function handle(name: string, handler: (data: any) => any): (data: any) => any {
    handlers[name] = handler;
    return handler;
}

/**
 * Remove already set handler either for remote procedure or event.
 * @param handler - instance of handler that is set for actions.
 */
export function remove(handler: (data: any) => any): void {

    Object.keys(events).forEach(key => {
        if (events[key] === handler) {
            delete events[key];
        }
    });

    Object.keys(handlers).forEach(key => {
        if (handlers[key] === handler) {
            delete handlers[key];
        }
    });
}
