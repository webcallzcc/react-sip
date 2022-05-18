"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FILES = require("./sounds.json");
var SOUNDS = new Map();
var initialized = false;
var AudioPlay = (function () {
    function AudioPlay(audio, volume) {
        this.audio = audio;
        this.volume = volume;
    }
    return AudioPlay;
}());
var audioPlayer = {
    initialize: function () {
        if (initialized)
            return;
        SOUNDS = new Map([
            ['ringback', { audio: new Audio(FILES['ringback']), volume: 1.0 }],
            ['ringing', { audio: new Audio(FILES['ringing']), volume: 1.0 }],
            ['answered', { audio: new Audio(FILES['answered']), volume: 1.0 }],
            ['rejected', { audio: new Audio(FILES['rejected']), volume: 0.5 }]
        ]);
        SOUNDS.forEach(function (sound) {
            sound.audio.volume = 0;
            try {
                sound.audio.play();
            }
            catch (error) { }
        });
        initialized = true;
    },
    play: function (name, relativeVolume, loop) {
        if (relativeVolume === void 0) { relativeVolume = 1.0; }
        if (loop === void 0) { loop = false; }
        this.initialize();
        if (typeof relativeVolume !== 'number')
            relativeVolume = 1.0;
        var sound = SOUNDS.get(name);
        if (!sound)
            throw new Error("unknown sound name \"" + name + "\"");
        try {
            sound.audio.pause();
            sound.audio.currentTime = 0.0;
            sound.audio.volume = (sound.volume || 1.0) * relativeVolume;
            sound.audio.loop = loop;
            sound.audio.play();
        }
        catch (error) {
        }
    },
    stop: function (name) {
        if (!initialized)
            return;
        var sound = SOUNDS.get(name);
        if (!sound)
            throw new Error("unknown sound name \"" + name + "\"");
        sound.audio.pause();
        sound.audio.currentTime = 0.0;
    }
};
exports.default = audioPlayer;
//# sourceMappingURL=audioPlayer.js.map