class Peer {
    constructor(socket, roomId, name) {
        this.id = socket.id;
        this.name = name;
        this.socket = socket;
        this.roomId = roomId;
        this.transports = new Map();
        this.producers = new Map();
        this.consumers = new Map();
        this.speaking = false;
        this.muted = false;
        this.audioEnabled = true; // Default audio enabled state
        this.screenProducers = new Map(); // Separate map for screen sharing producers
    }

    setSpeaking(speaking) {
        if (!this.muted) {
            this.speaking = speaking;
        }
    }

    isSpeaking() {
        return !this.muted && this.speaking;
    }

    setMuted(muted) {
        this.muted = muted;
        if (muted) {
            this.speaking = false;
        }
    }

    isMuted() {
        return this.muted;
    }

    isScreenSharing() {
        return this.screenProducers.size > 0;
    }

    addProducer(producer) {
        if (producer.appData?.mediaType === 'screen') {
            this.screenProducers.set(producer.kind, producer);
        }
        this.producers.set(producer.id, producer);
    }

    getProducer(producerId) {
        return this.producers.get(producerId);
    }

    removeProducer(producerId) {
        const producer = this.producers.get(producerId);
        if (producer && producer.appData?.mediaType === 'screen') {
            this.screenProducers.delete(producer.kind);
        }
        this.producers.delete(producerId);
    }

    getScreenProducer(kind) {
        return this.screenProducers.get(kind);
    }

    hasScreenProducer(kind) {
        return this.screenProducers.has(kind);
    }

    addTransport(transport) {
        this.transports.set(transport.id, transport);
    }

    getTransport(transportId) {
        return this.transports.get(transportId);
    }

    removeTransport(transportId) {
        this.transports.delete(transportId);
    }

    addConsumer(consumer) {
        this.consumers.set(consumer.id, consumer);
    }

    getConsumer(consumerId) {
        return this.consumers.get(consumerId);
    }

    removeConsumer(consumerId) {
        this.consumers.delete(consumerId);
    }

    close() {
        // Close all screen sharing producers
        this.screenProducers.forEach(producer => {
            producer.close();
        });
        this.screenProducers.clear();

        this.transports.forEach(transport => transport.close());
        this.producers.forEach(producer => producer.close());
        this.consumers.forEach(consumer => consumer.close());
        
        this.transports.clear();
        this.producers.clear();
        this.consumers.clear();
    }

    setAudioEnabled(enabled) {
        this.audioEnabled = enabled;
    }

    isAudioEnabled() {
        return this.audioEnabled;
    }
}

module.exports = Peer; 