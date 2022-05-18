declare const audioPlayer: {
    initialize(): void;
    play(name: any, relativeVolume?: number, loop?: boolean): void;
    stop(name: any): void;
};
export default audioPlayer;
