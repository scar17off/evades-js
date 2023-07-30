const eventemitter = require("events");
const WebSocket = require("ws");
const axios = require('axios');

console.clear();

const parcelRequire = require("./client-require.js");
// const encoder = parcelRequire("fYSqx");
// const decoder = parcelRequire("9Etmg");
// const ccodegen = parcelRequire("dGQ4b");
// const Type = parcelRequire("b9mnO");
// const Writer = parcelRequire("8ZbRf");
// const util = parcelRequire("dGQ4b");
// const Reader = parcelRequire("hKJaw");
// const Message = parcelRequire("h1CyE");
const protocol = parcelRequire("3V5RS");

// console.log(protocol.ClientPayload);

class EJS extends eventemitter {
    constructor(options = {}) {
        super();

        this.player = {};
        this.players = {};
        this.world = {entities: null, globalEntities: null}

        this.clientOptions = {};

        if(options.HeroType) this.clientOptions.HeroType = options.HeroType;
        else this.clientOptions.HeroType = gameDataProtocol.HeroType.MAGMAX;

        if(options.server) this.clientOptions.server = options.server;
        else this.clientOptions.server = "0";

        if(this.clientOptions.server - 1 < 0) this.clientOptions.server = "0";

        if(options.location == "us") this.clientOptions.location = '';
        else if(options.location == "eu") this.clientOptions.location = "eu.";
        else this.clientOptions.location = "eu.";

        if(options.ws) this.clientOptions.wss = options.wss;
        else this.clientOptions.wss = `wss://${this.clientOptions.location}evades.io/api/game/connect?backend=${this.clientOptions.server - 1}&game=0`;

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
        } else {
            this.clientOptions.sessionCookie = null;
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

        this.ws.sequence++;
        if(this.ws.sequence >= 256) this.ws.sequence = 0;
    };
    setMouseMovement(x, y) {
        let data = {
            mouseDown: {
                x,
                y,
                updated: true
            }
        };

        this.ws.send(protocol.ClientPayload.encode(protocol.ClientPayload.create(data)).finish());
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

            dv.setInt8(0, 8);
            dv.setInt8(1, this.clientOptions.HeroType + 1);
            dv.setInt8(2, 16);
            dv.setInt8(3, 0);

            this.ws.send(buffer);
            // this.ws.send(protocol.ClientPayload.encode(data).finish());

            this.emit("open");
        };

        this.ws.onmessage = (msg) => {
            msg = msg.data;

            if(typeof msg == "string") {
                if(msg.startsWith("{") && msg.endsWith("}")) {
                    msg = JSON.parse(msg);
                    if(msg.message == "OK" || msg.message == "Restored") {
                        this.username = msg.username;
                        this.skipHeroSelection = msg.message === "Restored";
                        setTimeout(() => this.emit("join"), 1000);
                    };
                };
            };

            if(typeof msg == "string") return;

            let t = new Uint8Array(msg);
            if(t.byteLength === 0) return;

            msg = protocol.FramePayload.decode(t);
            msg = protocol.FramePayload.toObject(msg);

            // if(Object.keys(msg).length > 3) console.log(Object.keys(msg));

            this.emit("message", msg);

            if(msg.chat) {
                this.emit("messages", msg.chat.messages);
                this.emit("rawMessage", `${msg.chat.messages[0].sender}: ${msg.chat.messages[0].text}`);
                this.emit("chatMessage", msg.chat.messages[0]);
            }

            if(!msg.globalEntities || !msg.entities) return;

            const entities = {};
            const existingEntityIndexes = Object.keys(msg.entities);

            for(let index = 0; index < existingEntityIndexes.length; index++) {
                const entityId = existingEntityIndexes[index];
                const entityData = msg.entities[entityId];
                entities[entityId] = entityData;
            };

            const newGlobalEntityIds = Object.keys(msg.globalEntities);

            for(let newIndex = 0; newIndex < newGlobalEntityIds.length; newIndex++) {
                const entityId = newGlobalEntityIds[newIndex];
                const entityData = msg.globalEntities[entityId];

                if(entityData.removed) {
                    if(this.players[entityId]) {
                        this.emit("playerLeft", this.players[entityId]);
                    };
                    delete this.players[entityId];
                    continue;
                };

                if(this.players[entityId]) {
                    for(const key in entityData) {
                        if(entityData.hasOwnProperty(key)) {
                            this.players[entityId][key] = entityData[key];
                        };
                    };
                } else {
                    this.players[entityId] = entityData;
                    this.emit("playerJoin", entityData);
                };
            };

            this.world.entities = entities;

            let players = Object.values(entities).filter(entity => entity.entityType === gameDataProtocol.EntityType.PLAYER);

            players.forEach(player => {
                if(!this.players[player.id]) {
                    this.players[player.id] = player;
                };

                Object.assign(this.players[player.id], player);
            });

            for(let i = 0; i < msg.globalEntities.length; i++) {
                const update = msg.globalEntities[i];
                const playerId = update.id;
              
                if(update.removed) {
                    delete this.players[playerId];
                    this.emit("playerLeft", playerId);
                    continue;
                };
              
                if(this.players[playerId]) {
                    Object.assign(this.players[playerId], update);
                } else {
                    this.players[playerId] = update;
                    this.emit("playerJoin", update);
                };
            };

            for(const playerId in this.players) {
                if(this.players.hasOwnProperty(playerId)) {
                    const player = this.players[playerId];
                    if(player.name === this.username) {
                        this.player = player;
                        break;
                    };
                };
            };
        };

        this.ws.onclose = () => {
            this.emit("close");
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
    },
    EntityType: {
        PLAYER: 0,
        PELLET: 1,
        WALL_ENEMY: 2,
        NORMAL_ENEMY: 3,
        HOMING_ENEMY: 4,
        DASHER_ENEMY: 5,
        SLOWING_ENEMY: 6,
        DRAINING_ENEMY: 7,
        REPELLING_ENEMY: 8,
        GRAVITY_ENEMY: 9,
        TURNING_ENEMY: 10,
        SIZING_ENEMY: 11,
        SNIPER_ENEMY: 12,
        FREEZING_ENEMY: 13,
        TELEPORTING_ENEMY: 14,
        WAVY_ENEMY: 15,
        ZIGZAG_ENEMY: 16,
        ZONING_ENEMY: 17,
        SPIRAL_ENEMY: 18,
        OSCILLATING_ENEMY: 19,
        SWITCH_ENEMY: 20,
        LIQUID_ENEMY: 21,
        ICICLE_ENEMY: 22,
        SLIPPERY_ENEMY: 23,
        ICE_SNIPER_ENEMY: 24,
        DISABLING_ENEMY: 25,
        EXPERIENCE_DRAIN_ENEMY: 26,
        ENLARGING_ENEMY: 27,
        SPEED_SNIPER_ENEMY: 28,
        REGEN_SNIPER_ENEMY: 29,
        RADIATING_BULLETS_ENEMY: 30,
        IMMUNE_ENEMY: 31,
        PUMPKIN_ENEMY: 32,
        TREE_ENEMY: 33,
        FROST_GIANT_ENEMY: 34,
        SNOWMAN_ENEMY: 35,
        CORROSIVE_ENEMY: 36,
        TOXIC_ENEMY: 37,
        CORROSIVE_SNIPER_ENEMY: 38,
        POISON_SNIPER_ENEMY: 39,
        MAGNETIC_REDUCTION_ENEMY: 40,
        MAGNETIC_NULLIFICATION_ENEMY: 41,
        POSITIVE_MAGNETIC_SNIPER_ENEMY: 42,
        NEGATIVE_MAGNETIC_SNIPER_ENEMY: 43,
        RESIDUE_ENEMY: 44,
        FIRE_TRAIL_ENEMY: 45,
        ICE_GHOST_ENEMY: 46,
        POISON_GHOST_ENEMY: 47,
        POSITIVE_MAGNETIC_GHOST_ENEMY: 48,
        NEGATIVE_MAGNETIC_GHOST_ENEMY: 49,
        WIND_GHOST_ENEMY: 50,
        LUNGING_ENEMY: 51,
        LAVA_ENEMY: 52,
        GRAVITY_GHOST_ENEMY: 53,
        REPELLING_GHOST_ENEMY: 54,
        STAR_ENEMY: 55,
        GRASS_ENEMY: 56,
        SEEDLING_ENEMY: 57,
        FLOWER_ENEMY: 58,
        DISABLING_GHOST_ENEMY: 59,
        GLOWY_ENEMY: 60,
        FIREFLY_ENEMY: 61,
        MIST_ENEMY: 62,
        PHANTOM_ENEMY: 63,
        CYBOT_ENEMY: 64,
        EABOT_ENEMY: 65,
        WABOT_ENEMY: 66,
        FIBOT_ENEMY: 67,
        AIBOT_ENEMY: 68,
        WIND_SNIPER_ENEMY: 69,
        SAND_ENEMY: 70,
        SANDROCK_ENEMY: 71,
        QUICKSAND_ENEMY: 72,
        CRUMBLING_ENEMY: 73,
        RADAR_ENEMY: 74,
        BARRIER_ENEMY: 75,
        SPEED_GHOST_ENEMY: 76,
        REGEN_GHOST_ENEMY: 77,
        CACTUS_ENEMY: 78,
        CYCLING_ENEMY: 79,
        REVERSE_PROJECTILE: 80,
        MINIMIZE_PROJECTILE: 81,
        REANIMATE_PROJECTILE: 82,
        SNIPER_PROJECTILE: 83,
        VENGEANCE_PROJECTILE: 84,
        BLACK_HOLE_PROJECTILE: 85,
        ICE_SNIPER_PROJECTILE: 86,
        SNOWBALL_PROJECTILE: 87,
        SPEED_SNIPER_PROJECTILE: 88,
        REGEN_SNIPER_PROJECTILE: 89,
        RADIATING_BULLETS_PROJECTILE: 90,
        LATCH_PROJECTILE: 91,
        SPARK_PROJECTILE: 92,
        LIGHTNING_PROJECTILE: 93,
        SHADOW_PROJECTILE: 94,
        SWEET_TOOTH_ITEM: 95,
        OBSCURE_PROJECTILE: 96,
        LEAF_PROJECTILE: 97,
        FROST_GIANT_ICE_PROJECTILE: 98,
        ORBIT_PROJECTILE: 99,
        ENERGIZE_PROJECTILE: 100,
        CORROSIVE_SNIPER_PROJECTILE: 101,
        POISON_SNIPER_PROJECTILE: 102,
        POSITIVE_MAGNETIC_SNIPER_PROJECTILE: 103,
        NEGATIVE_MAGNETIC_SNIPER_PROJECTILE: 104,
        CRUMBLE_PROJECTILE: 105,
        RADIOACTIVE_GLOOP_PROJECTILE: 106,
        BLOOM_PROJECTILE: 107,
        POLLINATE_PROJECTILE: 108,
        SEEDLING_PROJECTILE: 109,
        FLOWER_PROJECTILE: 110,
        SOULSTONE_PROJECTILE: 111,
        GRAVE_PROJECTILE: 112,
        EABOT_PROJECTILE: 113,
        WABOT_PROJECTILE: 114,
        FIBOT_PROJECTILE: 115,
        AIBOT_PROJECTILE: 116,
        WIND_SNIPER_PROJECTILE: 117,
        RADAR_PROJECTILE: 118,
        ROBO_SCANNER_SNIPER_PROJECTILE: 119,
        ROBO_SCANNER_ICE_SNIPER_PROJECTILE: 120,
        ROBO_SCANNER_SPEED_SNIPER_PROJECTILE: 121,
        ROBO_SCANNER_REGEN_SNIPER_PROJECTILE: 122,
        ROBO_SCANNER_RADIATING_BULLETS_PROJECTILE: 123,
        ROBO_SCANNER_LEAF_PROJECTILE: 124,
        ROBO_SCANNER_CORROSIVE_SNIPER_PROJECTILE: 125,
        ROBO_SCANNER_POISON_SNIPER_PROJECTILE: 126,
        ROBO_SCANNER_POSITIVE_SNIPER_PROJECTILE: 127,
        ROBO_SCANNER_NEGATIVE_SNIPER_PROJECTILE: 128,
        ROBO_SCANNER_WIND_SNIPER_PROJECTILE: 129,
        ROBO_SCANNER_RADAR_PROJECTILE: 130,
        ECHELON_PROJECTILE: 131,
        IGNITION_SPARK_PROJECTILE: 132,
        INCINERATE_PROJECTILE: 133,
        WALL: 134,
        BARRIER_DOME: 135,
        STREAM_PATH: 136,
        FLASHLIGHT_ITEM: 137,
        TORCH: 138,
        LIGHT_REGION: 139
    }
};

module.exports = { Client: EJS, gameDataProtocol };
