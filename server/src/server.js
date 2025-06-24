const express = require('express');
const cors = require('cors');
const compression = require('compression');
const mediasoup = require('mediasoup');
const config = require('./config');
const Room = require('./Room');
const Peer = require('./Peer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// SSL certificates
const options = {
  key: fs.readFileSync('/app/ssl/private.key'),
  cert: fs.readFileSync('/app/ssl/certificate.crt')
};

const server = https.createServer(options, app);
const io = new Server(server, {
    cors: {
        origin: ["https://4931257-dv98943.twc1.net"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Configure CORS for Express
app.use(cors({
    origin: ["https://4931257-dv98943.twc1.net"],
    credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

const rooms = new Map();
const peers = new Map();

let workers = [];
let nextWorkerIndex = 0;

async function runMediasoupWorkers() {
    const { numWorkers = Object.keys(os.cpus()).length } = config.mediasoup;

    for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker({
            logLevel: config.mediasoup.worker.logLevel,
            logTags: config.mediasoup.worker.logTags,
            rtcMinPort: config.mediasoup.worker.rtcMinPort,
            rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
        });

        worker.on('died', () => {
            console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });

        workers.push(worker);
    }
}

function getMediasoupWorker() {
    const worker = workers[nextWorkerIndex];
    nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
    return worker;
}

async function createRoom(roomId, worker) {
    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    const router = await worker.createRouter({ mediaCodecs });
    const room = new Room(roomId, router, io);
    rooms.set(roomId, room);
    return room;
}

io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    // Add voice activity event handlers
    socket.on('speaking', ({ speaking }) => {
        const peer = peers.get(socket.id);
        if (!peer || !socket.data?.roomId) return;

        const room = rooms.get(socket.data.roomId);
        if (!room) return;

        // Only update speaking state if the peer is not muted
        if (!peer.isMuted()) {
            peer.setSpeaking(speaking);
            // Broadcast speaking state to all peers in the room
            socket.to(room.id).emit('speakingStateChanged', {
                peerId: socket.id,
                speaking: speaking && !peer.isMuted()
            });
        }
    });

    socket.on('muteState', ({ isMuted }) => {
        const peer = peers.get(socket.id);
        if (!peer || !socket.data?.roomId) return;

        const room = rooms.get(socket.data.roomId);
        if (!room) return;

        peer.setMuted(isMuted);
        
        // If muted, ensure speaking state is false
        if (isMuted) {
            peer.setSpeaking(false);
        }

        // Broadcast mute state to all peers in the room
        socket.to(room.id).emit('peerMuteStateChanged', {
            peerId: socket.id,
            isMuted
        });

        // Also broadcast speaking state update if needed
        if (isMuted) {
            socket.to(room.id).emit('speakingStateChanged', {
                peerId: socket.id,
                speaking: false
            });
        }
    });

    socket.on('createRoom', async ({ roomId }, callback) => {
        if (!callback || typeof callback !== 'function') {
            console.error('Callback is not a function for createRoom event');
            return;
        }

        try {
            if (rooms.has(roomId)) {
                callback({ error: 'room already exists' });
                return;
            }

            const worker = getMediasoupWorker();
            const room = await createRoom(roomId, worker);
            callback({ roomId });
        } catch (error) {
            console.error('Error in createRoom:', error);
            callback({ error: error.message });
        }
    });

    socket.on('join', async ({ roomId, name }, callback) => {
        try {
            // Create room if it doesn't exist
            let room = rooms.get(roomId);
            if (!room) {
                const worker = getMediasoupWorker();
                room = await createRoom(roomId, worker);
                rooms.set(roomId, room);
            }

            // Create peer
            const peer = new Peer(socket, roomId, name);
            peer.setMuted(false); // Ensure peer starts unmuted
            peer.setAudioEnabled(true); // Ensure audio starts enabled
            peers.set(socket.id, peer);
            room.addPeer(peer);

            // Store room ID in socket data
            socket.data.roomId = roomId;
            socket.join(roomId);

            // Get existing peers
            const existingPeers = [];
            room.peers.forEach((existingPeer) => {
                if (existingPeer.id !== socket.id) {
                    existingPeers.push({
                        id: existingPeer.id,
                        name: existingPeer.name,
                        isMuted: existingPeer.isMuted(),
                        isAudioEnabled: existingPeer.isAudioEnabled()
                    });
                }
            });

            // Get existing producers
            const existingProducers = [];
            room.producers.forEach((producerData, producerId) => {
                if (producerData.peerId !== socket.id) {
                    existingProducers.push({
                        producerId,
                        producerSocketId: producerData.peerId,
                        kind: producerData.producer.kind
                    });
                }
            });

            // Notify other peers about the new peer BEFORE sending callback
            socket.to(roomId).emit('peerJoined', {
                peerId: peer.id,
                name: peer.name,
                isMuted: peer.isMuted(),
                isAudioEnabled: Boolean(peer.isAudioEnabled())
            });

            console.log(`Peer ${name} (${socket.id}) joined room ${roomId}`);
            console.log('Existing peers:', existingPeers);
            console.log('Existing producers:', existingProducers);

            // Send router RTP capabilities and existing peers/producers
            callback({
                routerRtpCapabilities: room.router.rtpCapabilities,
                existingPeers,
                existingProducers
            });

        } catch (error) {
            console.error('Error in join:', error);
            callback({ error: error.message });
        }
    });

    socket.on('createWebRtcTransport', async (callback) => {
        try {
            if (!socket.data?.roomId) {
                throw new Error('Not joined to any room');
            }

            const peer = peers.get(socket.id);
            if (!peer) {
                throw new Error('Peer not found');
            }

            const room = rooms.get(socket.data.roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            const transport = await room.createWebRtcTransport(config.mediasoup.webRtcTransport);
            peer.addTransport(transport);

            transport.on('routerclose', () => {
                transport.close();
                peer.removeTransport(transport.id);
            });

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (error) {
            console.error('Error in createWebRtcTransport:', error);
            callback({ error: error.message });
        }
    });

    socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
        try {
            if (!socket.data?.roomId) {
                throw new Error('Not joined to any room');
            }

            const peer = peers.get(socket.id);
            if (!peer) {
                throw new Error('Peer not found');
            }

            const transport = peer.getTransport(transportId);
            if (!transport) {
                throw new Error('Transport not found');
            }

            await transport.connect({ dtlsParameters });
            callback();
        } catch (error) {
            console.error('Error in connectTransport:', error);
            callback({ error: error.message });
        }
    });

    socket.on('produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
        try {
            if (!socket.data?.roomId) {
                throw new Error('Not joined to any room');
            }

            const peer = peers.get(socket.id);
            if (!peer) {
                throw new Error('Peer not found');
            }

            const room = rooms.get(socket.data.roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            const transport = peer.getTransport(transportId);
            if (!transport) {
                throw new Error('Transport not found');
            }

            // Handle screen sharing producers
            if (appData?.mediaType === 'screen' || appData?.mediaType === 'screen-audio') {
                // For video stream, check if peer is already sharing screen
                if (kind === 'video' && appData.mediaType === 'screen' && room.isPeerSharingScreen(socket.id)) {
                    throw new Error('Already sharing screen');
                }
                
                console.log('Creating screen sharing producer:', { kind, appData });

                const producerOptions = {
                    kind,
                    rtpParameters,
                    appData
                };

                // Optimize video settings for screen sharing
                if (kind === 'video') {
                    producerOptions.encodings = [
                        {
                            maxBitrate: 5000000, // 5 Mbps для Full HD
                            scaleResolutionDownBy: 1, // Без уменьшения разрешения
                            maxFramerate: 60
                        }
                    ];
                    producerOptions.codecOptions = {
                        videoGoogleStartBitrate: 3000,
                        videoGoogleMinBitrate: 1000,
                        videoGoogleMaxBitrate: 5000
                    };
                    producerOptions.keyFrameRequestDelay = 2000;
                }

                // Optimize audio settings for screen sharing
                if (kind === 'audio' && appData.mediaType === 'screen-audio') {
                    producerOptions.codecOptions = {
                        opusStereo: true,
                        opusDtx: true,
                        opusFec: true,
                        opusMaxPlaybackRate: 48000
                    };
                }

                const producer = await transport.produce(producerOptions);

                console.log('Screen sharing producer created:', { 
                    id: producer.id, 
                    kind: producer.kind, 
                    appData: producer.appData 
                });

                peer.addProducer(producer);
                room.addProducer(socket.id, producer);

                producer.on('transportclose', () => {
                    console.log('Screen sharing producer transport closed:', producer.id);
                    producer.close();
                    peer.removeProducer(producer.id);
                    room.removeProducer(producer.id);
                    
                    // Notify peers about closed producer
                    socket.to(room.id).emit('producerClosed', {
                        producerId: producer.id,
                        producerSocketId: socket.id
                    });
                });

                callback({ id: producer.id });
                return;
            }

            // Handle regular media producers
            const producer = await transport.produce({
                kind,
                rtpParameters,
                appData
            });

            console.log('Regular producer created:', {
                id: producer.id,
                kind: producer.kind,
                appData: producer.appData
            });

            peer.addProducer(producer);
            room.addProducer(socket.id, producer);

            producer.on('transportclose', () => {
                console.log('Producer transport closed:', producer.id);
                producer.close();
                peer.removeProducer(producer.id);
                room.removeProducer(producer.id);
                
                socket.to(room.id).emit('producerClosed', {
                    producerId: producer.id,
                    producerSocketId: socket.id
                });
            });

            callback({ id: producer.id });
        } catch (error) {
            console.error('Error in produce:', error);
            callback({ error: error.message });
        }
    });

    socket.on('consume', async ({ rtpCapabilities, remoteProducerId, transportId }, callback) => {
        try {
            if (!socket.data?.roomId) {
                throw new Error('Not joined to any room');
            }

            const peer = peers.get(socket.id);
            if (!peer) {
                throw new Error('Peer not found');
            }

            const room = rooms.get(socket.data.roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            const transport = peer.getTransport(transportId);
            if (!transport) {
                throw new Error('Transport not found');
            }

            const producer = room.getProducer(remoteProducerId);
            if (!producer) {
                console.error('Producer not found:', remoteProducerId);
                console.log('Available producers:', Array.from(room.producers.keys()));
                throw new Error('Producer not found');
            }

            console.log('Creating consumer for producer:', {
                producerId: producer.id,
                kind: producer.kind,
                appData: producer.appData
            });

            if (!room.router.canConsume({
                producerId: producer.id,
                rtpCapabilities
            })) {
                throw new Error('Cannot consume');
            }

            // Optimize consumer settings for screen sharing
            const consumerOptions = {
                producerId: producer.id,
                rtpCapabilities,
                paused: true
            };

            // Add specific settings for screen sharing consumers
            if (producer.appData?.mediaType === 'screen') {
                consumerOptions.preferredLayers = { spatialLayer: 2, temporalLayer: 2 };
                consumerOptions.bufferSize = 512 * 1024; // 512KB buffer for screen sharing
            }

            const consumer = await transport.consume(consumerOptions);

            console.log('Consumer created:', {
                id: consumer.id,
                kind: consumer.kind,
                appData: producer.appData
            });

            peer.addConsumer(consumer);
            room.addConsumer(socket.id, consumer);

            consumer.on('transportclose', () => {
                console.log('Consumer transport closed:', consumer.id);
                consumer.close();
                peer.removeConsumer(consumer.id);
                room.removeConsumer(consumer.id);
            });

            consumer.on('producerclose', () => {
                console.log('Consumer producer closed:', consumer.id);
                consumer.close();
                peer.removeConsumer(consumer.id);
                room.removeConsumer(consumer.id);
                socket.emit('consumerClosed', { 
                    consumerId: consumer.id,
                    producerId: producer.id,
                    producerSocketId: room.producers.get(producer.id)?.peerId
                });
            });

            consumer.on('score', (score) => {
                socket.emit('consumerScore', {
                    consumerId: consumer.id,
                    score
                });
            });

            callback({
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused,
                appData: producer.appData
            });

        } catch (error) {
            console.error('Error in consume:', error);
            callback({ error: error.message });
        }
    });

    socket.on('resumeConsumer', async ({ consumerId }, callback) => {
        try {
            const room = rooms.get(socket.data.roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            const consumer = room.getConsumer(consumerId);
            if (!consumer) {
                throw new Error('Consumer not found');
            }

            console.log('Resuming consumer:', consumerId);
            await consumer.resume();
            callback();
        } catch (error) {
            console.error('Error in resumeConsumer:', error);
            callback({ error: error.message });
        }
    });

    socket.on('stopScreenSharing', async ({ producerId }) => {
        try {
            console.log('Stop screen sharing request:', { producerId });
            
            const peer = peers.get(socket.id);
            if (!peer) {
                console.error('Peer not found for socket:', socket.id);
                return;
            }

            const room = rooms.get(socket.data?.roomId);
            if (!room) {
                console.error('Room not found for peer:', socket.id);
                return;
            }

            // Находим и закрываем producer демонстрации экрана
            const producer = peer.getProducer(producerId);
            if (producer && producer.appData?.mediaType === 'screen') {
                console.log('Found screen sharing producer:', producerId);
                // Логируем сокеты в комнате
                const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(room.id) || []);
                console.log('Sockets in room', room.id, socketsInRoom);
                // Сначала уведомляем всех участников
                const eventData = {
                    producerId,
                    producerSocketId: socket.id,
                    mediaType: 'screen'
                };
                console.log('Sending producerClosed event with data:', eventData);
                io.to(room.id).emit('producerClosed', eventData);
                
                // Удаляем producer из комнаты (это также очистит связанные consumers)
                room.removeProducer(producerId);
                
                // Удаляем producer из пира
                peer.removeProducer(producerId);
                
                // Закрываем producer
                if (!producer.closed) {
                    producer.close();
                }

                console.log('Screen sharing stopped successfully:', { 
                    peerId: socket.id, 
                    producerId 
                });
            } else {
                console.error('Screen sharing producer not found:', producerId);
            }
        } catch (error) {
            console.error('Error stopping screen sharing:', error);
        }
    });

    socket.on('restartIce', async ({ transportId }, callback) => {
        try {
            if (!socket.data?.roomId) {
                throw new Error('Not joined to any room');
            }

            const peer = peers.get(socket.id);
            if (!peer) {
                throw new Error('Peer not found');
            }

            const transport = peer.getTransport(transportId);
            if (!transport) {
                throw new Error('Transport not found');
            }

            const iceParameters = await transport.restartIce();
            callback({ iceParameters });
        } catch (error) {
            console.error('Error in restartIce:', error);
            callback({ error: error.message });
        }
    });

    socket.on('producerClosed', async ({ producerId, producerSocketId, mediaType }) => {
        try {
            console.log('Producer closed request:', { producerId, producerSocketId, mediaType });
            
            const peer = peers.get(socket.id);
            if (!peer) {
                console.error('Peer not found for socket:', socket.id);
                return;
            }

            const room = rooms.get(socket.data?.roomId);
            if (!room) {
                console.error('Room not found for peer:', socket.id);
                return;
            }

            // Находим producer
            const producer = peer.getProducer(producerId);
            if (producer) {
                console.log('Found producer to close:', producerId);
                
                // Логируем сокеты в комнате
                const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(room.id) || []);
                console.log('Sockets in room', room.id, socketsInRoom);
                
                // Сначала уведомляем всех участников
                const eventData = {
                    producerId,
                    producerSocketId: socket.id,
                    mediaType
                };
                console.log('Sending producerClosed event with data:', eventData);
                io.to(room.id).emit('producerClosed', eventData);
                
                // Удаляем producer из комнаты (это также очистит связанные consumers)
                room.removeProducer(producerId);
                
                // Удаляем producer из пира
                peer.removeProducer(producerId);
                
                // Закрываем producer
                if (!producer.closed) {
                    producer.close();
                }

                console.log(`${mediaType} producer closed successfully:`, { 
                    peerId: socket.id, 
                    producerId 
                });
            } else {
                console.error(`${mediaType} producer not found:`, producerId);
            }
        } catch (error) {
            console.error(`Error closing ${mediaType} producer:`, error);
        }
    });

    // Add audio disabled state handling
    socket.on('audioDisabledStateChanged', ({ isAudioDisabled }) => {
        if (!socket.data?.roomId) {
            console.error('Room ID not found for socket:', socket.id);
            return;
        }

        // Broadcast to all peers in the room except the sender
        socket.to(socket.data.roomId).emit('peerAudioDisabledStateChanged', {
            peerId: socket.id,
            isAudioDisabled
        });
    });

    // Add audio state handling
    socket.on('audioState', ({ isEnabled }) => {
        const peer = peers.get(socket.id);
        if (peer) {
            // Update peer's audio state
            peer.setAudioEnabled(isEnabled);
            
            // Broadcast to all peers in the room except sender
            socket.to(peer.roomId).emit('peerAudioStateChanged', {
                peerId: socket.id,
                isEnabled
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        const peer = peers.get(socket.id);
        if (!peer) return;

        const room = rooms.get(socket.data?.roomId);
        if (!room) return;

        // Уведомляем о закрытии всех producers перед удалением пира
        peer.producers.forEach((producer, producerId) => {
            const mediaType = producer.appData?.mediaType || 'unknown';
            io.to(room.id).emit('producerClosed', {
                producerId,
                producerSocketId: socket.id,
                mediaType
            });
        });

        // Close all transports, producers, and consumers
        peer.close();

        // Remove peer from room and peers map
        room.removePeer(socket.id);
        peers.delete(socket.id);

        // Notify other peers
        socket.to(room.id).emit('peerLeft', {
            peerId: socket.id
        });

        // If room is empty, remove it
        if (room.getPeers().size === 0) {
            rooms.delete(room.id);
        }
    });
});

async function run() {
    await runMediasoupWorkers();

    const port = config.server.listen.port || 3000;
    server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

run(); 