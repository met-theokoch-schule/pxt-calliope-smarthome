namespace SimxSample {
    // 🛠️ TASK: Update this to your project's channel.
    const SIMX_CHANNEL = "microsoft/pxt-simx-sample"

    //% block
    export function sendString(s: string) {
        const msg = {
            type: "string",
            value: s
        }
        control.simmessages.send(SIMX_CHANNEL, Buffer.fromUTF8(JSON.stringify(msg)), false);
    }

    let stringMessageHandler: (val: string) => void;

    //% block
    //% draggableParameters="reporter"
    export function onReceiveString(handler: (val: string) => void) {
        stringMessageHandler = handler;
    }

    function handleSimxMessage(b: Buffer) {
        const s = b.toString();
        const msg = JSON.parse(s);
        if (!msg.type) return;
        switch (msg.type) {
            case "string": {
                if (stringMessageHandler) stringMessageHandler(msg.value);
                break;
            }
        }
    }

    /**
     * Register to receive simx messages
     */
    //% shim=TD_NOOP
    function registerSimx() {
        control.simmessages.onReceived(SIMX_CHANNEL, handleSimxMessage)
        const msg = { type: "init" };
        control.simmessages.send(SIMX_CHANNEL, Buffer.fromUTF8(JSON.stringify(msg)), false);
    }

    // Register simulator extension on load
    registerSimx();
}
