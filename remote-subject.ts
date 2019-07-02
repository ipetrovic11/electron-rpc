import * as RPC from './rpc';
import { BehaviorSubject } from 'rxjs';

/**
 * RemoteSubject extends BehaviorSubject and supports cross processes
 * handling of changes. If it is updated in one process it will be
 * updated in all other processes which do have the same name;
 */
export default class RemoteSubject<T> extends BehaviorSubject<T> {

    name: string;

    private init: string;
    private update: string;

    constructor(name, value) {
        super(value);
        this.name = name;

        this.init = `${name}-init`;
        this.update = `${name}-update`;

        if (value) {
            RPC.handle(this.init, async () => {
                return this.value;
            });
            RPC.emit(this.update, value);
        } else {
            RPC.call(this.init).then(data => {
                super.next(data);
            });
        }

        RPC.on(this.update, () => {
            super.next(value);
        });
    }

    next(newValue?: T): void {
        RPC.emit(this.update, newValue);
        super.next(newValue);
    }
}
