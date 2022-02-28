import * as RPC from './rpc';
import { BehaviorSubject } from 'rxjs';

/**
 * RemoteSubject extends BehaviorSubject and supports cross processes
 * handling of changes. If it is updated in one process it will be
 * updated in all other processes which do have the same name;
 */
export class RemoteSubject<T> extends BehaviorSubject<T> {

    static registry: { [name: string]: RemoteSubject<any> } = {};

    name: string;
    ready: Promise<boolean>;

    private init: string;
    private update: string;

    constructor(name: string, value?: T) {

        if (RemoteSubject.registry[name]) {
            return RemoteSubject.registry[name];
        }
        super(value || null);
        this.name = name;
        RemoteSubject.register(name, this);

        this.init = `${name}-init`;
        this.update = `${name}-update`;

        if (RPC.type === RPC.ProcessType.Main) {
            RPC.handle(this.init, async () => {
                return this.value;
            });
            this.ready = Promise.resolve(true);
        }

        if (value) {
            RPC.emit(this.update, value);
        } else if (RPC.type !== RPC.ProcessType.Main) {
            this.ready = new Promise((resolve, reject) => {
                RPC.call(this.init, null, 2500, 2).then(data => {
                    resolve(true);
                    super.next(data);
                }).catch(error => {
                    reject(error);
                });
            });
        }

        RPC.on(this.update, newValue => {
            super.next(newValue);
        });
    }

    static register(name: string, subject: RemoteSubject<any>) { this.registry[name] = subject; }
    static Deregister(name: string) { delete this.registry[name]; }
    static clearRegistry() { this.registry = {}; }

    next(newValue?: T): void {
        RPC.emit(this.update, newValue);
        super.next(newValue);
    }

}
