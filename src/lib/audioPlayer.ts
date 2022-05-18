import * as FILES from './sounds.json';

let SOUNDS = new Map<string, AudioPlay>();
let initialized = false;

class AudioPlay {

	public audio: HTMLAudioElement;

	public volume: number;


	constructor(audio: HTMLAudioElement, volume: number) {
		this.audio = audio;
		this.volume = volume;
	}

}

const audioPlayer =
{
	/**
	 * Play all the sounds so they will play in mobile browsers at any time
	 */
	initialize() {
		if (initialized)
			return;

		SOUNDS = new Map<string, AudioPlay>(
			[
				['ringback', { audio: new Audio(FILES['ringback']), volume: 1.0 }],
				['ringing', { audio: new Audio(FILES['ringing']), volume: 1.0 }],
				['answered', { audio: new Audio(FILES['answered']), volume: 1.0 }],
				['rejected', { audio: new Audio(FILES['rejected']), volume: 0.5 }]
			]);

		SOUNDS.forEach((sound) => {

			sound.audio.volume = 0;

			try {
				sound.audio.play();
			}
			catch (error) { }
		})

		initialized = true;
	},

	/**
	 * Play a sound
	 * @param {String} name - Sound name
	 * @param {[Float]} relativeVolume - Relative volume (0.0 - 1.0)
	 */
	play(name, relativeVolume = 1.0, loop = false) {
		this.initialize();

		if (typeof relativeVolume !== 'number')
			relativeVolume = 1.0;

		const sound = SOUNDS.get(name);

		if (!sound)
			throw new Error(`unknown sound name "${name}"`);

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

	stop(name) {

		if (!initialized)
			return;

		const sound = SOUNDS.get(name);

		if (!sound)
			throw new Error(`unknown sound name "${name}"`);

		sound.audio.pause();
		sound.audio.currentTime = 0.0;
	}
};

export default audioPlayer;