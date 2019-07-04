# Electron RPC

Module for easy electron RPC communication between main process, workers and all windows at the same time.
It is using main process as message broker and both events and messages are send and forget.

## How to install

Installation
``` 
npm install @workpuls/electron-rpc --save 
```

In each process you have to init broker, and it is important not to forget to do the same in main process.
```
import { Broker } from '@workpuls/electron-rpc';
Broker.init();
```

### Broker
Broker is used for cross-process communication.

emit - for emitting events
call - calling remote function/procedure, returning promise so that function can have return value

on - action that needs to be done once event is detected
handle - handling call that's done and function return is what is resolved as promise

remove - removes any handler that is registered bboth with on and handle

Action can be handled just by one process and thats either main process or window that has solved execution first.
If you need multiple processes to do the same action use emit.

### RemoteSubject
Remote subject is extending Behaviour subject, but it is synched based on name between processes.
