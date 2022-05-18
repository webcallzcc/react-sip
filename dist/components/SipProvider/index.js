"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var JsSIP = require("jssip");
var PropTypes = require("prop-types");
var React = require("react");
var dummyLogger_1 = require("../../lib/dummyLogger");
var audioPlayer_1 = require("../../lib/audioPlayer");
var enums_1 = require("../../lib/enums");
var types_1 = require("../../lib/types");
var SipProvider = (function (_super) {
    __extends(SipProvider, _super);
    function SipProvider(props) {
        var _this = _super.call(this, props) || this;
        _this.registerSip = function () {
            return _this.ua.register();
        };
        _this.unregisterSip = function () {
            return _this.ua.unregister();
        };
        _this.answerCall = function () {
            if (_this.state.callStatus !== enums_1.CALL_STATUS_STARTING ||
                _this.state.callDirection !== enums_1.CALL_DIRECTION_INCOMING) {
                throw new Error("Calling answerCall() is not allowed when call status is " + _this.state.callStatus + " and call direction is " + _this.state.callDirection + "  (expected " + enums_1.CALL_STATUS_STARTING + " and " + enums_1.CALL_DIRECTION_INCOMING + ")");
            }
            _this.state.rtcSession.answer({
                pcConfig: {
                    iceServers: _this.props.iceServers,
                    rtcpMuxPolicy: 'negotiate'
                },
            });
        };
        _this.startCall = function (destination, hasVideo) {
            if (hasVideo === void 0) { hasVideo = false; }
            if (!destination) {
                throw new Error("Destination must be defined (" + destination + " given)");
            }
            if (_this.state.sipStatus !== enums_1.SIP_STATUS_CONNECTED &&
                _this.state.sipStatus !== enums_1.SIP_STATUS_REGISTERED) {
                throw new Error("Calling startCall() is not allowed when sip status is " + _this.state.sipStatus + " (expected " + enums_1.SIP_STATUS_CONNECTED + " or " + enums_1.SIP_STATUS_REGISTERED + ")");
            }
            if (_this.state.callStatus !== enums_1.CALL_STATUS_IDLE) {
                throw new Error("Calling startCall() is not allowed when call status is " + _this.state.callStatus + " (expected " + enums_1.CALL_STATUS_IDLE + ")");
            }
            var _a = _this.props, iceServers = _a.iceServers, sessionTimersExpires = _a.sessionTimersExpires;
            var extraHeaders = _this.props.extraHeaders.invite;
            var options = {
                extraHeaders: extraHeaders,
                mediaConstraints: { audio: true, video: hasVideo ? true : false },
                rtcOfferConstraints: { iceRestart: _this.props.iceRestart },
                pcConfig: {
                    iceServers: iceServers,
                    rtcpMuxPolicy: 'negotiate'
                },
                sessionTimersExpires: sessionTimersExpires,
            };
            _this.ua.call(destination, options);
            _this.setState({ callStatus: enums_1.CALL_STATUS_STARTCALL, calltype: hasVideo ? 'video' : 'audio' });
        };
        _this.stopCall = function () {
            _this.setState({ callStatus: enums_1.CALL_STATUS_STOPPING, });
            var rtcSession = _this.state.rtcSession;
            if (rtcSession) {
                rtcSession.terminate();
            }
            _this.setState({
                rtcSession: null,
            });
        };
        _this.logCall = function (session, status) {
            var log = {
                clid: session.remote_identity.displayName || session.remote_identity.uri.user,
                user: session.remote_identity.uri.user,
                uri: session.remote_identity.uri.toString(),
                id: session.id,
                time: new Date().getTime()
            };
            var calllogs = JSON.parse(localStorage.getItem('sipCalls') || '{}');
            if (!calllogs) {
                calllogs = {};
            }
            if (!calllogs.hasOwnProperty(session.id)) {
                calllogs[log.id] = {
                    id: log.id,
                    user: log.user,
                    clid: log.clid,
                    uri: log.uri,
                    start: log.time,
                    flow: session.direction
                };
            }
            if (status === 'in call') {
                calllogs[log.id].startTime = new Date().getTime();
            }
            if (status === 'ended') {
                calllogs[log.id].stop = log.time;
            }
            if (status === 'ended' && (calllogs[log.id].status === 'ringing'
                || calllogs[log.id].status === 'waiting'
                || calllogs[log.id].status === 'connecting')) {
                calllogs[log.id].status = 'missed';
            }
            else {
                calllogs[log.id].status = status;
            }
            localStorage.setItem('sipCalls', JSON.stringify(calllogs));
            _this.setState({ calllogs: Object.keys(calllogs).map(function (e) { return calllogs[e]; }).sort(function (a, b) { return b.start - a.start; }) });
        };
        _this.state = {
            sipStatus: enums_1.SIP_STATUS_DISCONNECTED,
            sipErrorType: null,
            sipErrorMessage: null,
            rtcSession: null,
            callStatus: enums_1.CALL_STATUS_IDLE,
            callDirection: null,
            callCounterpart: null,
            calltype: null,
            localHold: false,
            remoteHold: false,
            calllogs: [],
            muteStatus: {
                audio: false,
                video: false,
            },
        };
        _this.ua = null;
        return _this;
    }
    SipProvider.prototype.changeMuteAudio = function (mute) {
        var rtcSession = this.state.rtcSession;
        if (!rtcSession) {
            return;
        }
        if (mute) {
            rtcSession.mute({ audio: true });
        }
        else {
            rtcSession.unmute({ audio: true });
        }
    };
    SipProvider.prototype.changeMuteVideo = function (mute) {
        var rtcSession = this.state.rtcSession;
        if (!rtcSession) {
            return;
        }
        if (mute) {
            rtcSession.mute({ video: true });
        }
        else {
            rtcSession.unmute({ video: true });
        }
    };
    SipProvider.prototype.changeHold = function (hold) {
        var rtcSession = this.state.rtcSession;
        if (!rtcSession) {
            return;
        }
        if (hold) {
            rtcSession.hold({ useUpdate: true });
        }
        else {
            rtcSession.unhold({ useUpdate: true });
        }
    };
    SipProvider.prototype.sendDTMF = function (dtmf) {
        var rtcSession = this.state.rtcSession;
        if (!rtcSession) {
            return;
        }
        rtcSession.sendDTMF(dtmf, { transportType: 'RFC2833' });
    };
    SipProvider.prototype.getChildContext = function () {
        return {
            sip: __assign({}, this.props, { status: this.state.sipStatus, errorType: this.state.sipErrorType, errorMessage: this.state.sipErrorMessage }),
            call: {
                id: "??",
                status: this.state.callStatus,
                direction: this.state.callDirection,
                counterpart: this.state.callCounterpart,
                calltype: this.state.calltype,
            },
            registerSip: this.registerSip,
            unregisterSip: this.unregisterSip,
            answerCall: this.answerCall,
            startCall: this.startCall,
            stopCall: this.stopCall,
        };
    };
    SipProvider.prototype.componentDidMount = function () {
        if (window.document.getElementById("sip-provider-audio")) {
            throw new Error("Creating two SipProviders in one application is forbidden. If that's not the case " +
                "then check if you're using \"sip-provider-audio\" as id attribute for any existing " +
                "element");
        }
        this.remoteAudio = window.document.createElement("audio");
        this.remoteAudio.id = "sip-provider-audio";
        window.document.body.appendChild(this.remoteAudio);
        audioPlayer_1.default.initialize();
        this.updateCallLog();
        this.reconfigureDebug();
        this.reinitializeJsSIP();
    };
    SipProvider.prototype.componentDidUpdate = function (prevProps) {
        if (this.props.debug !== prevProps.debug) {
            this.reconfigureDebug();
        }
        if (this.props.host !== prevProps.host ||
            this.props.socket !== prevProps.socket ||
            this.props.user !== prevProps.user ||
            this.props.auth !== prevProps.auth ||
            this.props.password !== prevProps.password ||
            this.props.autoRegister !== prevProps.autoRegister) {
            this.reinitializeJsSIP();
        }
    };
    SipProvider.prototype.componentWillUnmount = function () {
        this.remoteAudio.parentNode.removeChild(this.remoteAudio);
        delete this.remoteAudio;
        if (this.ua) {
            this.ua.stop();
            this.ua = null;
        }
    };
    SipProvider.prototype.reconfigureDebug = function () {
        var debug = this.props.debug;
        if (debug) {
            JsSIP.debug.enable("JsSIP:*");
            this.logger = console;
        }
        else {
            JsSIP.debug.disable();
            this.logger = dummyLogger_1.default;
        }
    };
    SipProvider.prototype.reinitializeJsSIP = function () {
        var _this = this;
        if (this.ua) {
            this.ua.stop();
            this.ua = null;
        }
        var _a = this.props, host = _a.host, socket = _a.socket, user = _a.user, auth = _a.auth, password = _a.password, autoRegister = _a.autoRegister, noPassword = _a.noPassword;
        if (!host || !socket || !user || !auth || (!password && !noPassword)) {
            this.setState({
                sipStatus: enums_1.SIP_STATUS_DISCONNECTED,
                sipErrorType: null,
                sipErrorMessage: null,
            });
            return;
        }
        try {
            var webSocket = new JsSIP.WebSocketInterface(socket);
            this.ua = new JsSIP.UA({
                uri: "sip:" + user + "@" + host,
                password: password,
                display_name: user,
                authorization_user: auth,
                sockets: [webSocket],
                register: autoRegister,
            });
        }
        catch (error) {
            this.logger.debug("Error", error.message, error);
            this.setState({
                sipStatus: enums_1.SIP_STATUS_ERROR,
                sipErrorType: enums_1.SIP_ERROR_TYPE_CONFIGURATION,
                sipErrorMessage: error.message,
            });
            return;
        }
        var ua = this.ua;
        ua.on("connecting", function () {
            _this.logger.debug('UA "connecting" event');
            if (_this.ua !== ua) {
                return;
            }
            _this.setState({
                sipStatus: enums_1.SIP_STATUS_CONNECTING,
                sipErrorType: null,
                sipErrorMessage: null,
            });
        });
        ua.on("connected", function () {
            _this.logger.debug('UA "connected" event');
            if (_this.ua !== ua) {
                return;
            }
            _this.setState({
                sipStatus: enums_1.SIP_STATUS_CONNECTED,
                sipErrorType: null,
                sipErrorMessage: null,
            });
        });
        ua.on("disconnected", function () {
            _this.logger.debug('UA "disconnected" event');
            if (_this.ua !== ua) {
                return;
            }
            _this.setState({
                sipStatus: enums_1.SIP_STATUS_DISCONNECTED,
                sipErrorType: enums_1.SIP_ERROR_TYPE_CONNECTION,
                sipErrorMessage: "disconnected",
            });
        });
        ua.on("registered", function (data) {
            _this.logger.debug('UA "registered" event', data);
            if (_this.ua !== ua) {
                return;
            }
            _this.setState({
                sipStatus: enums_1.SIP_STATUS_REGISTERED,
                callStatus: enums_1.CALL_STATUS_IDLE,
            });
            if (_this.props.onRegister) {
                _this.props.onRegister();
            }
        });
        ua.on("unregistered", function () {
            _this.logger.debug('UA "unregistered" event');
            if (_this.ua !== ua) {
                return;
            }
            if (ua.isConnected()) {
                _this.setState({
                    sipStatus: enums_1.SIP_STATUS_CONNECTED,
                    callStatus: enums_1.CALL_STATUS_IDLE,
                    callDirection: null,
                });
            }
            else {
                _this.setState({
                    sipStatus: enums_1.SIP_STATUS_DISCONNECTED,
                    callStatus: enums_1.CALL_STATUS_IDLE,
                    callDirection: null,
                });
            }
        });
        ua.on("registrationFailed", function (data) {
            _this.logger.debug('UA "registrationFailed" event');
            if (_this.ua !== ua) {
                return;
            }
            if (ua.isConnected()) {
                _this.setState({
                    sipStatus: enums_1.SIP_STATUS_CONNECTED,
                    sipErrorType: enums_1.SIP_ERROR_TYPE_REGISTRATION,
                    sipErrorMessage: data.cause,
                });
            }
            else {
                _this.setState({
                    sipStatus: enums_1.SIP_STATUS_DISCONNECTED,
                    sipErrorType: enums_1.SIP_ERROR_TYPE_REGISTRATION,
                    sipErrorMessage: data.cause,
                });
            }
            _this.props.onNotify && _this.props.onNotify({
                level: 'error',
                title: 'Login Failed',
                message: data.cause
            });
            if (_this.props.onRegisterFailed) {
                _this.props.onRegisterFailed(data);
            }
        });
        ua.on("newRTCSession", function (_a) {
            var originator = _a.originator, rtcSession = _a.session, rtcRequest = _a.request;
            if (!_this || _this.ua !== ua) {
                return;
            }
            var rtcSessionInState = _this.state.rtcSession;
            if (rtcSessionInState) {
                rtcSession.terminate({
                    status_code: 486,
                    reason_phrase: "Busy Here",
                });
                return;
            }
            _this.setState({ rtcSession: rtcSession });
            if (originator === "local") {
                var foundUri = rtcRequest.to.toString();
                var delimiterPosition = foundUri.indexOf(";") || null;
                _this.setState({
                    callDirection: enums_1.CALL_DIRECTION_OUTGOING,
                    callStatus: enums_1.CALL_STATUS_STARTING,
                    callCounterpart: foundUri.substring(0, delimiterPosition) || foundUri,
                });
                _this.logCall(rtcSession, 'connecting');
            }
            else if (originator === "remote") {
                var foundUri = rtcRequest.from.toString();
                var delimiterPosition = foundUri.indexOf(";") || null;
                _this.setState({
                    callDirection: enums_1.CALL_DIRECTION_INCOMING,
                    callStatus: enums_1.CALL_STATUS_STARTING,
                    callCounterpart: foundUri.substring(0, delimiterPosition) || foundUri,
                });
                audioPlayer_1.default.play('ringing', 1.0, true);
                _this.logCall(rtcSession, 'ringing');
            }
            rtcSession.on('connecting', function () {
                if (_this.ua !== ua) {
                    return;
                }
                if (_this.props.streamLocalId &&
                    document.getElementById(_this.props.streamLocalId)
                    && rtcSession.connection
                    && rtcSession.connection.getLocalStreams()) {
                    _this.localAudio = document.getElementById(_this.props.streamLocalId);
                    _this.localAudio.srcObject = rtcSession.connection.getLocalStreams()[0];
                    var calltypeVideo = _this.localAudio.srcObject && _this.localAudio.srcObject.getVideoTracks &&
                        _this.localAudio.srcObject.getVideoTracks()[0];
                    _this.setState({ calltype: calltypeVideo ? 'video' : 'audio' });
                }
            });
            if (originator === "local") {
                rtcSession.on('progress', function () {
                    if (_this.ua !== ua) {
                        return;
                    }
                    _this.setState({
                        callDirection: enums_1.CALL_DIRECTION_OUTGOING,
                        callStatus: enums_1.CALL_STATUS_STARTING,
                    });
                    audioPlayer_1.default.play('ringback', 1.0, true);
                    _this.logCall(rtcSession, 'waiting');
                });
            }
            rtcSession.on("failed", function (data) {
                if (_this.ua !== ua) {
                    return;
                }
                if (originator === "local") {
                    audioPlayer_1.default.stop('ringback');
                    audioPlayer_1.default.play('rejected');
                }
                else if (originator === "remote") {
                    audioPlayer_1.default.stop('ringing');
                }
                _this.setState({
                    rtcSession: null,
                    callStatus: enums_1.CALL_STATUS_IDLE,
                    callDirection: null,
                    callCounterpart: null,
                });
                _this.logCall(rtcSession, 'ended');
                _this.props.onNotify && _this.props.onNotify({
                    level: 'error',
                    title: 'Call Error',
                    message: data.cause
                });
            });
            rtcSession.on("ended", function (data) {
                if (_this.ua !== ua) {
                    return;
                }
                if (originator === "local") {
                    audioPlayer_1.default.stop('ringback');
                }
                else if (originator === "remote") {
                }
                _this.logCall(rtcSession, 'ended');
                _this.setState({
                    rtcSession: null,
                    callStatus: enums_1.CALL_STATUS_IDLE,
                    callDirection: null,
                    callCounterpart: null,
                });
                _this.props.onNotify && _this.props.onNotify({
                    level: 'info',
                    title: 'End Call',
                    message: data.cause
                });
            });
            rtcSession.on('muted', function (data) {
                if (_this.ua !== ua) {
                    return;
                }
                if (data.audio) {
                    var muteStatus = _this.state.muteStatus;
                    muteStatus.audio = true;
                    _this.setState({ muteStatus: muteStatus });
                }
                if (data.video) {
                    var muteStatus = _this.state.muteStatus;
                    muteStatus.video = true;
                    _this.setState({ muteStatus: muteStatus });
                }
            });
            rtcSession.on('unmuted', function (data) {
                if (_this.ua !== ua) {
                    return;
                }
                if (data.audio) {
                    var muteStatus = _this.state.muteStatus;
                    muteStatus.audio = false;
                    _this.setState({ muteStatus: muteStatus });
                }
                if (data.video) {
                    var muteStatus = _this.state.muteStatus;
                    muteStatus.video = false;
                    _this.setState({ muteStatus: muteStatus });
                }
            });
            rtcSession.on('hold', function (data) {
                if (_this.ua !== ua) {
                    return;
                }
                _this.logCall(rtcSession, 'holding');
                switch (data.originator) {
                    case 'local':
                        _this.setState({ localHold: true });
                        break;
                    case 'remote':
                        _this.setState({ remoteHold: true });
                        break;
                }
            });
            rtcSession.on('unhold', function (data) {
                if (_this.ua !== ua) {
                    return;
                }
                _this.logCall(rtcSession, 'in call');
                switch (data.originator) {
                    case 'local':
                        _this.setState({ localHold: false });
                        break;
                    case 'remote':
                        _this.setState({ remoteHold: false });
                        break;
                }
            });
            rtcSession.on("accepted", function () {
                if (_this.ua !== ua) {
                    return;
                }
                if (originator === "local") {
                    audioPlayer_1.default.stop('ringback');
                    audioPlayer_1.default.play('answered');
                }
                else if (originator === "remote") {
                    audioPlayer_1.default.stop('ringing');
                    audioPlayer_1.default.play('answered');
                }
                _this.logCall(rtcSession, 'in call');
                if (rtcSession.direction === 'outgoing') {
                    _this.props.onNotify && _this.props.onNotify({
                        level: 'success',
                        title: 'Start call'
                    });
                }
                if (_this.props.streamRemoteId
                    && document.getElementById(_this.props.streamRemoteId)
                    && rtcSession.connection
                    && rtcSession.connection.getRemoteStreams()) {
                    _this.remoteStream = document.getElementById(_this.props.streamRemoteId);
                    _this.remoteStream.srcObject = rtcSession.connection.getRemoteStreams()[0];
                    _this.setState({ callStatus: enums_1.CALL_STATUS_ACTIVE });
                    return;
                }
                _this.remoteAudio.srcObject = rtcSession.connection.getRemoteStreams()[0];
                var played = _this.remoteAudio.play();
                if (typeof played !== "undefined") {
                    played
                        .catch(function () {
                    })
                        .then(function () {
                        setTimeout(function () {
                            _this.remoteAudio.play();
                        }, 500);
                    });
                    _this.setState({ callStatus: enums_1.CALL_STATUS_ACTIVE });
                    return;
                }
                setTimeout(function () {
                    _this.remoteAudio.play();
                }, 500);
                _this.setState({ callStatus: enums_1.CALL_STATUS_ACTIVE });
            });
            if (_this.state.callDirection === enums_1.CALL_DIRECTION_INCOMING &&
                _this.props.autoAnswer) {
                _this.logger.log("Answer auto ON");
                _this.answerCall();
            }
            else if (_this.state.callDirection === enums_1.CALL_DIRECTION_INCOMING &&
                !_this.props.autoAnswer) {
                _this.logger.log("Answer auto OFF");
            }
            else if (_this.state.callDirection === enums_1.CALL_DIRECTION_OUTGOING) {
                _this.logger.log("OUTGOING call");
            }
        });
        var extraHeadersRegister = this.props.extraHeaders.register || [];
        if (extraHeadersRegister.length) {
            ua.registrator().setExtraHeaders(extraHeadersRegister);
        }
        ua.start();
    };
    SipProvider.prototype.updateCallLog = function () {
        var calllogs = JSON.parse(localStorage.getItem('sipCalls') || '{}');
        if (!calllogs) {
            calllogs = {};
        }
        else {
            var update = false;
            for (var e in calllogs) {
                if (calllogs[e].status != 'missed' && calllogs[e].status != 'ended') {
                    calllogs[e].status = 'ended';
                    update = true;
                }
            }
            if (update) {
                localStorage.setItem('sipCalls', JSON.stringify(calllogs));
            }
        }
        calllogs = Object.keys(calllogs).map(function (e) { return calllogs[e]; }).sort(function (a, b) { return b.start - a.start; });
        this.setState({ calllogs: calllogs });
    };
    SipProvider.prototype.removeCallLog = function (id) {
        var calllogs = JSON.parse(localStorage.getItem('sipCalls') || '{}');
        if (!calllogs) {
            calllogs = {};
        }
        if (calllogs.hasOwnProperty(id)) {
            delete calllogs[id];
        }
        localStorage.setItem('sipCalls', JSON.stringify(calllogs));
        this.setState({ calllogs: Object.keys(calllogs).map(function (e) { return calllogs[e]; }).sort(function (a, b) { return b.start - a.start; }) });
    };
    SipProvider.prototype.render = function () {
        var _this = this;
        return React.Children.map(this.props.children, function (child) {
            if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                    sip: __assign({}, _this.props, { status: _this.state.sipStatus, errorType: _this.state.sipErrorType, errorMessage: _this.state.sipErrorMessage }),
                    call: {
                        id: "??",
                        status: _this.state.callStatus,
                        direction: _this.state.callDirection,
                        counterpart: _this.state.callCounterpart,
                        calllogs: _this.state.calllogs,
                        calltype: _this.state.calltype,
                    },
                    action: {
                        removeCallLog: _this.removeCallLog.bind(_this),
                        changeMuteAudio: _this.changeMuteAudio.bind(_this),
                        changeMuteVideo: _this.changeMuteVideo.bind(_this),
                        changeHold: _this.changeHold.bind(_this),
                        sendDTMF: _this.sendDTMF.bind(_this),
                    },
                    localHold: _this.state.localHold,
                    remoteHold: _this.state.remoteHold,
                    muteStatus: _this.state.muteStatus,
                    rtcSession: _this.state.rtcSession,
                    registerSip: _this.registerSip,
                    unregisterSip: _this.unregisterSip,
                    answerCall: _this.answerCall,
                    startCall: _this.startCall,
                    stopCall: _this.stopCall
                });
            }
            return child;
        });
    };
    SipProvider.childContextTypes = {
        sip: types_1.sipPropType,
        call: types_1.callPropType,
        muteStatus: types_1.muteStatusPropType,
        registerSip: PropTypes.func,
        unregisterSip: PropTypes.func,
        answerCall: PropTypes.func,
        startCall: PropTypes.func,
        stopCall: PropTypes.func,
    };
    SipProvider.propTypes = {
        host: PropTypes.string,
        socket: PropTypes.string,
        user: PropTypes.string,
        auth: PropTypes.string,
        password: PropTypes.string,
        autoRegister: PropTypes.bool,
        autoAnswer: PropTypes.bool,
        iceRestart: PropTypes.bool,
        noPassword: PropTypes.bool,
        sessionTimersExpires: PropTypes.number,
        extraHeaders: types_1.extraHeadersPropType,
        iceServers: types_1.iceServersPropType,
        streamLocalId: PropTypes.string,
        streamRemoteId: PropTypes.string,
        onNotify: PropTypes.func,
        onRegister: PropTypes.func,
        onRegisterFailed: PropTypes.func,
        debug: PropTypes.bool,
        children: PropTypes.node,
    };
    SipProvider.defaultProps = {
        host: null,
        socket: "",
        user: null,
        auth: null,
        password: null,
        autoRegister: true,
        autoAnswer: false,
        iceRestart: false,
        noPassword: true,
        sessionTimersExpires: 120,
        extraHeaders: { register: [], invite: [] },
        iceServers: [],
        streamLocalId: '',
        streamRemoteId: '',
        onNotify: null,
        onRegister: null,
        onRegisterFailed: null,
        debug: false,
        children: null,
    };
    return SipProvider;
}(React.Component));
exports.default = SipProvider;
//# sourceMappingURL=index.js.map