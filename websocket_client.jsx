// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const MAX_WEBSOCKET_FAILS = 7;
const WEBSOCKET_RETRY_TIME = 3000;

export default class WebSocketClient {
    constructor() {
        this.conn = null;
        this.sequence = 1;
        this.connectFailCount = 0;
        this.manuallyClosed = false;
        this.eventCallback = null;
        this.reconnectCallback = null;
        this.errorCallback = null;
        this.closeCallback = null;
    }

    initialize(connectionUrl) {
        if (this.conn) {
            return;
        }

        if (this.connectFailCount === 0) {
            console.log('websocket connecting to ' + connectionUrl); //eslint-disable-line no-console
        }

        this.manuallyClosed = false;

        this.conn = new WebSocket(connectionUrl);

        this.conn.onopen = () => {
            if (this.connectFailCount > 0) {
                console.log('websocket re-established connection'); //eslint-disable-line no-console
                if (this.reconnectCallback) {
                    this.reconnectCallback();
                }
            }

            this.connectFailCount = 0;
        };

        this.conn.onclose = () => {
            this.conn = null;
            this.sequence = 1;

            if (this.connectFailCount === 0) {
                console.log('websocket closed'); //eslint-disable-line no-console
            }

            if (this.manuallyClosed) {
                return;
            }

            this.connectFailCount++;

            if (this.closeCallback) {
                this.closeCallback(this.connectFailCount);
            }

            if (this.connectFailCount <= MAX_WEBSOCKET_FAILS) {
                setTimeout(
                    () => {
                        this.initialize(connectionUrl);
                    },
                    WEBSOCKET_RETRY_TIME
                );
            }
        };

        this.conn.onerror = (evt) => {
            if (this.connectFailCount <= 1) {
                console.log('websocket error'); //eslint-disable-line no-console
                console.log(evt); //eslint-disable-line no-console
            }

            if (this.errorCallback) {
                this.errorCallback(evt);
            }
        };

        this.conn.onmessage = (evt) => {
            const msg = JSON.parse(evt.data);
            if (this.eventCallback) {
                this.eventCallback(msg);
            }
        };
    }

    setEventCallback(callback) {
        this.eventCallback = callback;
    }

    setReconnectCallback(callback) {
        this.reconnectCallback = callback;
    }

    setErrorCallback(callback) {
        this.errorCallback = callback;
    }

    setCloseCallback(callback) {
        this.closeCallback = callback;
    }

    close() {
        this.manuallyClosed = true;
        this.connectFailCount = 0;
        this.sequence = 1;
        if (this.conn && this.conn.readyState === WebSocket.OPEN) {
            this.conn.close();
        }
    }

    sendMessage(action, data) {
        const msg = {
            action,
            seq: this.sequence++,
            data
        };

        if (this.conn && this.conn.readyState === WebSocket.OPEN) {
            this.conn.send(JSON.stringify(msg));
        } else if (!this.conn || this.conn.readyState === WebSocket.Closed) {
            this.conn = null;
            this.initialize();
        }
    }

    userTyping(teamId, channelId, parentId) {
        const data = {};
        data.team_id = teamId;
        data.channel_id = channelId;
        data.parent_id = parentId;

        this.sendMessage('user_typing', data);
    }
}
