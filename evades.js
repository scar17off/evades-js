const eventemitter = require("events");
const WebSocket = require("ws");
const axios = require('axios');
const parcelRequire = require("./client-require.js");

console.clear();

const encoder = parcelRequire("fYSqx");
const decoder = parcelRequire("9Etmg");
const c = parcelRequire("dGQ4b");
const Type = parcelRequire("b9mnO");
const Writer = parcelRequire("8ZbRf");
const util = parcelRequire("dGQ4b");
const Reader = parcelRequire("hKJaw");
const Message = parcelRequire("h1CyE");
const protocol = parcelRequire("3V5RS");

// console.log(protocol.ClientPayload);

class EJS extends eventemitter {
    constructor(options = {}) {
        super();
        this.clientOptions = {};

        this.player = {};
        this.user = {
            username: null
        };

        if(options.HeroType) this.clientOptions.HeroType = options.HeroType;
        else this.clientOptions.HeroType = gameDataProtocol.HeroType.MAGMAX;
        if(options.ws) this.clientOptions.wss = options.wss;
        else this.clientOptions.wss = "wss://eu.evades.io/api/game/connect?backend=0&game=0";
        if(options.sessionCookie) {
            this.clientOptions.sessionCookie = options.sessionCookie;
            this.makeSocket();
        } else if(options.username && options.password && !options.sessionCookie) {
            this.clientOptions.username = options.username;
            this.clientOptions.password = options.password;

            axios.post("https://evades.io/api/auth/login", {
                username: this.clientOptions.username,
                password: this.clientOptions.password,
                captchaToken: null
            })
            .then(response => {
                if(response.headers["set-cookie"]) {
                    this.clientOptions.sessionCookie = response.headers["set-cookie"][0];
                    this.makeSocket();
                };
            })
            .catch(error => {
                console.error("[Error]:", error);
            });
        } else if(!options.username && !options.password && !options.sessionCookie) {
            axios.post("https://evades.io/api/auth/guest", {
                captchaToken: null
            })
            .then(response => {
                if(response.headers["set-cookie"]) {
                    this.clientOptions.sessionCookie = response.headers["set-cookie"][0];
                    this.makeSocket();
                };
            })
            .catch(error => {
                console.error("[Error]:", error);
            });
        };
    };
    setKeyState(key, value) {
        let keys = { "up": 1, "down": 3, "right": 4, "left": 2 };
        let values = { true: 1, false: 2 };
        
        let buffer = new ArrayBuffer(8);
        let dv = new DataView(buffer);

        dv.setInt8(0, 16);
        dv.setInt8(1, this.ws.sequence);
        dv.setInt8(2, 26);
        dv.setInt8(3, 4);
        dv.setInt8(4, 8);
        dv.setInt8(5, values[value]);
        dv.setInt8(6, 16);
        dv.setInt8(7, keys[key]);

        this.ws.send(buffer);
    };
    makeSocket() {
        let cookie = `session="${this.clientOptions.sessionCookie}"`;
        if(this.clientOptions.sessionCookie.length > 174) { // full cookie string
            cookie = this.clientOptions.sessionCookie;
        };

        this.ws = new WebSocket(this.clientOptions.wss, {
            headers: {
                Cookie: cookie
            }
        });

        this.ws.sequence = 1;

        this.ws.onopen = () => {
            let buffer = new ArrayBuffer(4);
            let dv = new DataView(buffer);

            if(this.clientOptions.HeroType === gameDataProtocol.HeroType.MAGMAX) {
                dv.setInt8(0, 16);
                dv.setInt8(1, 0);
            } else {
                dv.setInt8(0, 8);
                dv.setInt8(1, this.clientOptions.HeroType + 1);
                dv.setInt8(2, 16);
                dv.setInt8(3, 0);
            };

            this.ws.send(buffer);
            // this.ws.send(protocol.ClientPayload.encode(data).finish());

            setTimeout(() => {
                this.emit("join");
            }, 1000);
        };

        this.ws.onmessage = (msg) => {
            msg = msg.data;

            try {
                msg = JSON.parse(msg);
                if(msg.message == "OK") this.user.username = msg.username;
            } catch(error) { };

            if("string" == typeof msg) return;

            let t = new Uint8Array(msg);
            if(t.byteLength === 0) return;

            msg = protocol.FramePayload.decode(t);

            // console.log(msg);
        };

        this.ws.onclose = () => {
            console.log("Connection closed");
        };
    };
};

const gameDataProtocol = {
    HeroType: {
        MAGMAX: 0,
        RIME: 1,
        MORFE: 2,
        AURORA: 3,
        NECRO: 4,
        NEXUS: 5,
        BRUTE: 6,
        SHADE: 7,
        EUCLID: 8,
        CHRONO: 9,
        REAPER: 10,
        RAMESES: 11,
        JOLT: 12,
        GHOUL: 13,
        CENT: 14,
        JOTUUN: 15,
        CANDY: 16,
        MIRAGE: 17,
        BOLDROCK: 18,
        GLOB: 19,
        MAGNO: 20,
        IGNIS: 21,
        STELLA: 22,
        VIOLA: 23,
        MORTUUS: 24,
        CYBOT: 25,
        ECHELON: 26,
        DEMONA: 27
    }
};

module.exports = { Client: EJS, gameDataProtocol };