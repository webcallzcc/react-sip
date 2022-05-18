import * as PropTypes from "prop-types";
export interface ExtraHeaders {
    register?: string[];
    invite?: string[];
}
export declare const extraHeadersPropType: PropTypes.Requireable<{
    [x: string]: (string | null)[] | null;
}>;
export declare type IceServers = Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
    credentialType?: string;
    password?: string;
}>;
export declare const iceServersPropType: PropTypes.Requireable<(object | null)[]>;
export interface Sip {
    status?: string;
    errorType?: string;
    errorMessage?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    autoRegister?: boolean;
    autoAnswer: boolean;
    sessionTimersExpires: number;
    extraHeaders: ExtraHeaders;
    iceServers: IceServers;
    debug: boolean;
}
export declare const sipPropType: PropTypes.Requireable<PropTypes.InferProps<{
    status: PropTypes.Requireable<string>;
    errorType: PropTypes.Requireable<string>;
    errorMessage: PropTypes.Requireable<string>;
    host: PropTypes.Requireable<string>;
    port: PropTypes.Requireable<number>;
    user: PropTypes.Requireable<string>;
    password: PropTypes.Requireable<string>;
    autoRegister: PropTypes.Requireable<boolean>;
    autoAnswer: PropTypes.Requireable<boolean>;
    sessionTimersExpires: PropTypes.Requireable<number>;
    extraHeaders: PropTypes.Requireable<{
        [x: string]: (string | null)[] | null;
    }>;
    iceServers: PropTypes.Requireable<(object | null)[]>;
    debug: PropTypes.Requireable<boolean>;
}>>;
export interface Call {
    id: string;
    status: string;
    direction: string;
    counterpart: string;
}
export declare const callPropType: PropTypes.Requireable<PropTypes.InferProps<{
    id: PropTypes.Requireable<string>;
    status: PropTypes.Requireable<string>;
    direction: PropTypes.Requireable<string>;
    counterpart: PropTypes.Requireable<string>;
}>>;
export interface MuteStatus {
    audio: boolean;
    video: boolean;
}
export declare const muteStatusPropType: PropTypes.Requireable<PropTypes.InferProps<{
    audio: PropTypes.Requireable<boolean>;
    video: PropTypes.Requireable<boolean>;
}>>;
export interface CallLog {
    id: string;
    clid: string;
    uri: string;
    start: number;
    stop: number;
    flow: string;
    status: string;
}
export declare type ListCallLog = Array<CallLog>;
