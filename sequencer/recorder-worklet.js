class RecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.recordedChunks = [];
        this.isRecording = false;
        this.port.onmessage = this.handleMessage.bind(this);
    }

    handleMessage(event) {
        if (event.data === 'start') {
            this.isRecording = true;
            this.recordedChunks = [];
        } else if (event.data === 'stop') {
            this.isRecording = false;
            this.port.postMessage(this.recordedChunks);
        }
    }

    process(inputs) {
        if (!this.isRecording) return true;

        const input = inputs[0];
        const channelData = input[0];
        if (channelData) {
            this.recordedChunks.push(new Float32Array(channelData));
        }

        return true;
    }
}

registerProcessor('recorder-processor', RecorderProcessor);
