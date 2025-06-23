module.exports = {
    server: {
        listen: {
            port: 3000
        },
        ssl: {
            enabled: false,
            cert: '../ssl/cert.pem',
            key: '../ssl/key.pem',
        },
    },
    mediasoup: {
        numWorkers: Object.keys(require('os').cpus()).length,
        worker: {
            rtcMinPort: 40000,
            rtcMaxPort: 40100,
            logLevel: 'debug',
            logTags: [
                'info',
                'ice',
                'dtls',
                'rtp',
                'srtp',
                'rtcp',
                'rtx',
                'bwe',
                'score',
                'simulcast',
                'svc',
                'sctp'
            ]
        },
        router: {
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                    parameters: {
                        minptime: 10,
                        useinbandfec: 1,
                        usedtx: 0,
                        stereo: 1,
                        'sprop-stereo': 1,
                        maxaveragebitrate: 96000,
                        maxplaybackrate: 48000,
                        ptime: 20,
                        application: 'audio',
                        cbr: 1,
                    }
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                    parameters: {
                        'x-google-start-bitrate': 3000,
                        'x-google-min-bitrate': 1000,
                        'x-google-max-bitrate': 5000,
                        'x-google-max-quantization': 30,
                        'x-google-max-temporal-layers': 3
                    }
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP9',
                    clockRate: 90000,
                    parameters: {
                        'profile-id': 2,
                        'x-google-start-bitrate': 3000,
                        'x-google-min-bitrate': 1000,
                        'x-google-max-bitrate': 5000,
                        'x-google-max-quantization': 30,
                        'x-google-max-temporal-layers': 3
                    }
                },
                {
                    kind: 'video',
                    mimeType: 'video/h264',
                    clockRate: 90000,
                    parameters: {
                        'packetization-mode': 1,
                        'profile-level-id': '42e01f',
                        'level-asymmetry-allowed': 1,
                        'x-google-start-bitrate': 3000,
                        'x-google-min-bitrate': 1000,
                        'x-google-max-bitrate': 5000,
                        'x-google-max-quantization': 30
                    }
                }
            ]
        },
        webRtcTransport: {
            listenIps: [
                {
                    ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
                    announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '0.0.0.0'
                }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate: 3000000,
            minimumAvailableOutgoingBitrate: 1000000,
            maxIncomingBitrate: 10000000,
            defaultMaxIncomingBitrate: 8000000,
            maxOutgoingBitrate: 10000000,
            defaultMaxOutgoingBitrate: 8000000,
            enableSctp: false,
            numStreams: { OS: 1, MIS: 1 },
            maxSctpMessageSize: 262144,
            additionalSettings: {
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require',
                sdpSemantics: 'unified-plan'
            },
            turnServers: [
                {
                    urls: ['turn:185.119.59.23:3478'],
                    username: 'test',
                    credential: 'test123',
                    preferUdp: true
                },
                {
                    urls: ['turn:185.119.59.23:3478?transport=tcp'],
                    username: 'test',
                    credential: 'test123',
                    preferTcp: true
                }
                // {
                //     urls: ['turn:global.turn.twilio.com:3478?transport=udp'],
                //     username: 'test',
                //     credential: 'test123',
                //     preferUdp: true
                // },
                // {
                //     urls: ['turn:global.turn.twilio.com:3478?transport=tcp'],
                //     username: 'test',
                //     credential: 'test123',
                //     preferTcp: true
                // }
            ]
        }
    },
    turnServer: {
        enabled: true,
        urls: [
            'turn:185.119.59.23:3478',
            'turn:185.119.59.23:3478?transport=tcp'
            // 'turn:global.turn.twilio.com:3478?transport=udp',
            // 'turn:global.turn.twilio.com:3478?transport=tcp'
        ],
        username: 'test',
        credential: 'test123'
    }
}; 