import * as JsSIP from "jssip";
import * as PropTypes from "prop-types";
import * as React from "react";
import dummyLogger from "../../lib/dummyLogger";
import audioPlayer from '../../lib/audioPlayer';

import {
  CALL_DIRECTION_INCOMING,
  CALL_DIRECTION_OUTGOING,
  CALL_STATUS_ACTIVE,
  CALL_STATUS_IDLE,
  CALL_STATUS_STARTCALL,
  CALL_STATUS_STARTING,
  CALL_STATUS_STOPPING,
  SIP_ERROR_TYPE_CONFIGURATION,
  SIP_ERROR_TYPE_CONNECTION,
  SIP_ERROR_TYPE_REGISTRATION,
  SIP_STATUS_CONNECTED,
  SIP_STATUS_CONNECTING,
  SIP_STATUS_DISCONNECTED,
  SIP_STATUS_ERROR,
  SIP_STATUS_REGISTERED,
} from "../../lib/enums";
import {
  CallDirection,
  CallStatus,
  SipErrorType,
  SipStatus,
} from "../../lib/enums";
import {
  callPropType,
  ExtraHeaders,
  extraHeadersPropType,
  IceServers,
  iceServersPropType,
  sipPropType,
  MuteStatus,
  muteStatusPropType,
  ListCallLog,
} from "../../lib/types";

export default class SipProvider extends React.Component<
  {
    host: string;
    socket: string;
    user: string;
    auth: string;
    password: string;
    autoRegister: boolean;
    autoAnswer: boolean;
    iceRestart: boolean;
    noPassword: boolean;
    sessionTimersExpires: number;
    extraHeaders: ExtraHeaders;
    iceServers: IceServers;
    streamLocalId: string;
    streamRemoteId: string;
    onNotify: Function;
    onRegister: Function,
    onRegisterFailed: Function,
    debug: boolean;
  },
  {
    sipStatus: SipStatus;
    sipErrorType: SipErrorType | null;
    sipErrorMessage: string | null;
    callStatus: CallStatus;
    callDirection: CallDirection | null;
    callCounterpart: string | null;
    calllogs: ListCallLog | null;
    calltype: string | null;
    localHold: boolean;
    remoteHold: boolean;
    muteStatus: MuteStatus;
    rtcSession;
  }
> {
  public static childContextTypes = {
    sip: sipPropType,
    call: callPropType,
    muteStatus: muteStatusPropType,
    registerSip: PropTypes.func,
    unregisterSip: PropTypes.func,

    answerCall: PropTypes.func,
    startCall: PropTypes.func,
    stopCall: PropTypes.func,
  };

  public static propTypes = {
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
    extraHeaders: extraHeadersPropType,
    iceServers: iceServersPropType,
    streamLocalId: PropTypes.string,
    streamRemoteId: PropTypes.string,
    onNotify: PropTypes.func,
    onRegister: PropTypes.func,
    onRegisterFailed: PropTypes.func,
    debug: PropTypes.bool,

    children: PropTypes.node,
  };

  public static defaultProps = {
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
  private ua;
  private remoteAudio;
  private localAudio;
  private remoteStream;
  private logger;

  constructor(props) {
    super(props);

    this.state = {
      sipStatus: SIP_STATUS_DISCONNECTED,
      sipErrorType: null,
      sipErrorMessage: null,

      rtcSession: null,
      // errorLog: [],
      callStatus: CALL_STATUS_IDLE,
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

    this.ua = null;
  }

  public changeMuteAudio(mute) {
    const rtcSession = this.state.rtcSession;

    if (!rtcSession) {
      return;
    }

    if (mute) {
      rtcSession.mute({ audio: true });
    } else {
      rtcSession.unmute({ audio: true });
    }
  }

  public changeMuteVideo(mute) {
    const rtcSession = this.state.rtcSession;

    if (!rtcSession) {
      return;
    }

    if (mute) {
      rtcSession.mute({ video: true });
    } else {
      rtcSession.unmute({ video: true });
    }
  }

  public changeHold(hold) {

    const rtcSession = this.state.rtcSession;

    if (!rtcSession) {
      return;
    }

    if (hold) {
      rtcSession.hold({ useUpdate: true });
    } else {
      rtcSession.unhold({ useUpdate: true });
    }
  }


  public sendDTMF(dtmf) {

    const rtcSession = this.state.rtcSession;
    if (!rtcSession) {
      return;
    }

    rtcSession.sendDTMF(dtmf, { transportType: 'RFC2833' });

  }

  public getChildContext() {
    return {
      sip: {
        ...this.props,
        status: this.state.sipStatus,
        errorType: this.state.sipErrorType,
        errorMessage: this.state.sipErrorMessage,
      },
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
  }

  public componentDidMount() {
    if (window.document.getElementById("sip-provider-audio")) {
      throw new Error(
        `Creating two SipProviders in one application is forbidden. If that's not the case ` +
        `then check if you're using "sip-provider-audio" as id attribute for any existing ` +
        `element`,
      );
    }

    this.remoteAudio = window.document.createElement("audio");
    this.remoteAudio.id = "sip-provider-audio";
    window.document.body.appendChild(this.remoteAudio);

    audioPlayer.initialize();

    this.updateCallLog();
    this.reconfigureDebug();
    this.reinitializeJsSIP();
  }

  public componentDidUpdate(prevProps) {
    if (this.props.debug !== prevProps.debug) {
      this.reconfigureDebug();
    }
    if (
      this.props.host !== prevProps.host ||
      this.props.socket !== prevProps.socket ||
      this.props.user !== prevProps.user ||
      this.props.auth !== prevProps.auth ||
      this.props.password !== prevProps.password ||
      this.props.autoRegister !== prevProps.autoRegister
    ) {
      this.reinitializeJsSIP();
    }
  }

  public componentWillUnmount() {
    this.remoteAudio.parentNode.removeChild(this.remoteAudio);
    delete this.remoteAudio;

    if (this.ua) {
      this.ua.stop();
      this.ua = null;
    }
  }

  public registerSip = () => {
    return this.ua.register();
  };

  public unregisterSip = () => {
    return this.ua.unregister();
  };

  public answerCall = () => {
    if (
      this.state.callStatus !== CALL_STATUS_STARTING ||
      this.state.callDirection !== CALL_DIRECTION_INCOMING
    ) {
      throw new Error(
        `Calling answerCall() is not allowed when call status is ${this.state.callStatus
        } and call direction is ${this.state.callDirection
        }  (expected ${CALL_STATUS_STARTING} and ${CALL_DIRECTION_INCOMING})`,
      );
    }

    this.state.rtcSession.answer({
      pcConfig: {
        iceServers: this.props.iceServers,
        rtcpMuxPolicy: 'negotiate'
      },
    });
  };

  public startCall = (destination, hasVideo = false) => {
    if (!destination) {
      throw new Error(`Destination must be defined (${destination} given)`);
    }
    if (
      this.state.sipStatus !== SIP_STATUS_CONNECTED &&
      this.state.sipStatus !== SIP_STATUS_REGISTERED
    ) {
      throw new Error(
        `Calling startCall() is not allowed when sip status is ${this.state.sipStatus
        } (expected ${SIP_STATUS_CONNECTED} or ${SIP_STATUS_REGISTERED})`,
      );
    }

    if (this.state.callStatus !== CALL_STATUS_IDLE) {
      throw new Error(
        `Calling startCall() is not allowed when call status is ${this.state.callStatus
        } (expected ${CALL_STATUS_IDLE})`,
      );
    }

    const { iceServers, sessionTimersExpires } = this.props;
    const extraHeaders = this.props.extraHeaders.invite;

    const options = {
      extraHeaders,
      mediaConstraints: { audio: true, video: hasVideo ? true : false },
      rtcOfferConstraints: { iceRestart: this.props.iceRestart },
      pcConfig: {
        iceServers,
        rtcpMuxPolicy: 'negotiate'
      },
      sessionTimersExpires,
    };

    this.ua.call(destination, options);
    this.setState({ callStatus: CALL_STATUS_STARTCALL, calltype: hasVideo ? 'video' : 'audio' });
  };

  public stopCall = () => {
    this.setState({ callStatus: CALL_STATUS_STOPPING, });
    const { rtcSession: rtcSession } = this.state;
    if (rtcSession) {
      rtcSession.terminate();
    }
    this.setState({
      rtcSession: null,
    });
  };

  public reconfigureDebug() {
    const { debug } = this.props;

    if (debug) {
      JsSIP.debug.enable("JsSIP:*");
      this.logger = console;
    } else {
      JsSIP.debug.disable();
      this.logger = dummyLogger;
    }
  }

  public reinitializeJsSIP() {
    if (this.ua) {
      this.ua.stop();
      this.ua = null;
    }

    const { host, socket, user, auth, password, autoRegister, noPassword } = this.props;

    if (!host || !socket || !user || !auth || (!password && !noPassword)) {
      this.setState({
        sipStatus: SIP_STATUS_DISCONNECTED,
        sipErrorType: null,
        sipErrorMessage: null,
      });
      return;
    }

    try {
      const webSocket = new JsSIP.WebSocketInterface(
        socket
      );
      this.ua = new JsSIP.UA({
        uri: `sip:${user}@${host}`,
        password,
        display_name: user,
        authorization_user: auth,
        sockets: [webSocket],
        register: autoRegister,
      });
    } catch (error) {
      this.logger.debug("Error", error.message, error);
      this.setState({
        sipStatus: SIP_STATUS_ERROR,
        sipErrorType: SIP_ERROR_TYPE_CONFIGURATION,
        sipErrorMessage: error.message,
      });
      return;
    }

    const { ua } = this;
    ua.on("connecting", () => {
      this.logger.debug('UA "connecting" event');
      if (this.ua !== ua) {
        return;
      }
      this.setState({
        sipStatus: SIP_STATUS_CONNECTING,
        sipErrorType: null,
        sipErrorMessage: null,
      });
    });

    ua.on("connected", () => {
      this.logger.debug('UA "connected" event');
      if (this.ua !== ua) {
        return;
      }
      this.setState({
        sipStatus: SIP_STATUS_CONNECTED,
        sipErrorType: null,
        sipErrorMessage: null,
      });
    });

    ua.on("disconnected", () => {
      this.logger.debug('UA "disconnected" event');
      if (this.ua !== ua) {
        return;
      }
      this.setState({
        sipStatus: SIP_STATUS_DISCONNECTED,
        sipErrorType: SIP_ERROR_TYPE_CONNECTION,
        sipErrorMessage: "disconnected",
      });
    });

    ua.on("registered", (data) => {
      this.logger.debug('UA "registered" event', data);
      if (this.ua !== ua) {
        return;
      }
      this.setState({
        sipStatus: SIP_STATUS_REGISTERED,
        callStatus: CALL_STATUS_IDLE,
      });
      if (this.props.onRegister) {
        this.props.onRegister();
      }
    });

    ua.on("unregistered", () => {
      this.logger.debug('UA "unregistered" event');
      if (this.ua !== ua) {
        return;
      }
      if (ua.isConnected()) {
        this.setState({
          sipStatus: SIP_STATUS_CONNECTED,
          callStatus: CALL_STATUS_IDLE,
          callDirection: null,
        });
      } else {
        this.setState({
          sipStatus: SIP_STATUS_DISCONNECTED,
          callStatus: CALL_STATUS_IDLE,
          callDirection: null,
        });
      }
    });

    ua.on("registrationFailed", (data) => {
      this.logger.debug('UA "registrationFailed" event');
      if (this.ua !== ua) {
        return;
      }


      if (ua.isConnected()) {
        this.setState({
          sipStatus: SIP_STATUS_CONNECTED,
          sipErrorType: SIP_ERROR_TYPE_REGISTRATION,
          sipErrorMessage: data.cause,
        });
      } else {
        this.setState({
          sipStatus: SIP_STATUS_DISCONNECTED,
          sipErrorType: SIP_ERROR_TYPE_REGISTRATION,
          sipErrorMessage: data.cause,
        });
      }

      this.props.onNotify && this.props.onNotify(
        {
          level: 'error',
          title: 'Login Failed',
          message: data.cause
        });

      if (this.props.onRegisterFailed) {
        this.props.onRegisterFailed(data);
      }
    });

    ua.on(
      "newRTCSession",
      ({ originator, session: rtcSession, request: rtcRequest }) => {
        if (!this || this.ua !== ua) {
          return;
        }

        const { rtcSession: rtcSessionInState } = this.state;

        // Avoid if busy or other incoming
        if (rtcSessionInState) {
          rtcSession.terminate({
            status_code: 486,
            reason_phrase: "Busy Here",
          });
          return;
        }

        this.setState({ rtcSession });

        // identify call direction
        if (originator === "local") {
          const foundUri = rtcRequest.to.toString();
          const delimiterPosition = foundUri.indexOf(";") || null;
          this.setState({
            callDirection: CALL_DIRECTION_OUTGOING,
            callStatus: CALL_STATUS_STARTING,
            callCounterpart:
              foundUri.substring(0, delimiterPosition) || foundUri,
          });
          this.logCall(rtcSession, 'connecting');

        } else if (originator === "remote") {
          const foundUri = rtcRequest.from.toString();
          const delimiterPosition = foundUri.indexOf(";") || null;
          this.setState({
            callDirection: CALL_DIRECTION_INCOMING,
            callStatus: CALL_STATUS_STARTING,
            callCounterpart:
              foundUri.substring(0, delimiterPosition) || foundUri,
          });
          audioPlayer.play('ringing', 1.0, true);
          this.logCall(rtcSession, 'ringing');
        }


        rtcSession.on('connecting', () => {
          if (this.ua !== ua) {
            return;
          }

          if (this.props.streamLocalId &&
            document.getElementById(this.props.streamLocalId)
            && rtcSession.connection
            && rtcSession.connection.getLocalStreams()) {
            this.localAudio = document.getElementById(this.props.streamLocalId);
            this.localAudio.srcObject = rtcSession.connection.getLocalStreams()[0];

            var calltypeVideo = this.localAudio.srcObject && this.localAudio.srcObject.getVideoTracks &&
              this.localAudio.srcObject.getVideoTracks()[0]
            this.setState({ calltype: calltypeVideo ? 'video' : 'audio' })
          }
        });


        if (originator === "local") {

          rtcSession.on('progress', () => {
            if (this.ua !== ua) {
              return;
            }
            this.setState({
              callDirection: CALL_DIRECTION_OUTGOING,
              callStatus: CALL_STATUS_STARTING,
            });

            audioPlayer.play('ringback', 1.0, true);
            this.logCall(rtcSession, 'waiting');
          });

        }

        rtcSession.on("failed", (data) => {
          if (this.ua !== ua) {
            return;
          }

          if (originator === "local") {
            audioPlayer.stop('ringback');
            audioPlayer.play('rejected');
          } else if (originator === "remote") {
            audioPlayer.stop('ringing');
          }

          this.setState({
            rtcSession: null,
            callStatus: CALL_STATUS_IDLE,
            callDirection: null,
            callCounterpart: null,
          });

          this.logCall(rtcSession, 'ended');

          this.props.onNotify && this.props.onNotify(
            {
              level: 'error',
              title: 'Call Error',
              message: data.cause
            });

        });

        rtcSession.on("ended", (data) => {
          if (this.ua !== ua) {
            return;
          }

          if (originator === "local") {
            audioPlayer.stop('ringback');
          } else if (originator === "remote") {
          }

          this.logCall(rtcSession, 'ended');

          this.setState({
            rtcSession: null,
            callStatus: CALL_STATUS_IDLE,
            callDirection: null,
            callCounterpart: null,
          });

          this.props.onNotify && this.props.onNotify(
            {
              level: 'info',
              title: 'End Call',
              message: data.cause
            });

        });

        rtcSession.on('muted', (data) => {
          if (this.ua !== ua) {
            return;
          }

          if (data.audio) {
            var muteStatus = this.state.muteStatus;
            muteStatus.audio = true;
            this.setState({ muteStatus });
          }

          if (data.video) {
            var muteStatus = this.state.muteStatus;
            muteStatus.video = true;
            this.setState({ muteStatus });
          }

        });

        rtcSession.on('unmuted', (data) => {
          if (this.ua !== ua) {
            return;
          }

          if (data.audio) {
            var muteStatus = this.state.muteStatus;
            muteStatus.audio = false;
            this.setState({ muteStatus });
          }

          if (data.video) {
            var muteStatus = this.state.muteStatus;
            muteStatus.video = false;
            this.setState({ muteStatus });
          }


        });

        rtcSession.on('hold', (data) => {
          if (this.ua !== ua) {
            return;
          }

          this.logCall(rtcSession, 'holding');

          switch (data.originator) {
            case 'local':
              this.setState({ localHold: true });
              break;
            case 'remote':
              this.setState({ remoteHold: true });
              break;
          }
        });

        rtcSession.on('unhold', (data) => {
          if (this.ua !== ua) {
            return;
          }

          this.logCall(rtcSession, 'in call');

          switch (data.originator) {
            case 'local':
              this.setState({ localHold: false });
              break;
            case 'remote':
              this.setState({ remoteHold: false });
              break;
          }
        });



        rtcSession.on("accepted", () => {
          if (this.ua !== ua) {
            return;
          }

          if (originator === "local") {
            audioPlayer.stop('ringback');
            audioPlayer.play('answered');
          } else if (originator === "remote") {
            audioPlayer.stop('ringing');
            audioPlayer.play('answered');
          }
          this.logCall(rtcSession, 'in call');

          if (rtcSession.direction === 'outgoing') {
            this.props.onNotify && this.props.onNotify(
              {
                level: 'success',
                title: 'Start call'
              });
          }

          if (this.props.streamRemoteId
            && document.getElementById(this.props.streamRemoteId)
            && rtcSession.connection
            && rtcSession.connection.getRemoteStreams()) {
            this.remoteStream = document.getElementById(this.props.streamRemoteId);
            this.remoteStream.srcObject = rtcSession.connection.getRemoteStreams()[0];
            this.setState({ callStatus: CALL_STATUS_ACTIVE });
            return;
          }

          [
            this.remoteAudio.srcObject,
          ] = rtcSession.connection.getRemoteStreams();

          // const played = this.remoteAudio.play();
          const played = this.remoteAudio.play();

          if (typeof played !== "undefined") {
            played
              .catch(() => {
                /**/
              })
              .then(() => {
                setTimeout(() => {
                  this.remoteAudio.play();
                }, 500);
              });
            this.setState({ callStatus: CALL_STATUS_ACTIVE });
            return;
          }

          setTimeout(() => {
            this.remoteAudio.play();
          }, 500);

          this.setState({ callStatus: CALL_STATUS_ACTIVE });
        });

        if (
          this.state.callDirection === CALL_DIRECTION_INCOMING &&
          this.props.autoAnswer
        ) {
          this.logger.log("Answer auto ON");
          this.answerCall();
        } else if (
          this.state.callDirection === CALL_DIRECTION_INCOMING &&
          !this.props.autoAnswer
        ) {
          this.logger.log("Answer auto OFF");
        } else if (this.state.callDirection === CALL_DIRECTION_OUTGOING) {
          this.logger.log("OUTGOING call");
        }
      },
    );

    const extraHeadersRegister = this.props.extraHeaders.register || [];
    if (extraHeadersRegister.length) {
      ua.registrator().setExtraHeaders(extraHeadersRegister);
    }
    ua.start();
  }

  public updateCallLog() {
    var calllogs = JSON.parse(localStorage.getItem('sipCalls') || '{}');

    if (!calllogs) {
      calllogs = {};
    } else {
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
    calllogs = Object.keys(calllogs).map(e => calllogs[e]).sort((a, b) => b.start - a.start);
    this.setState({ calllogs: calllogs });

  }

  public removeCallLog(id) {
    var calllogs = JSON.parse(localStorage.getItem('sipCalls') || '{}');

    if (!calllogs) { calllogs = {}; }

    if (calllogs.hasOwnProperty(id)) {
      delete calllogs[id];
    }

    localStorage.setItem('sipCalls', JSON.stringify(calllogs));

    this.setState({ calllogs: Object.keys(calllogs).map(e => calllogs[e]).sort((a, b) => b.start - a.start) });
  }

  public logCall = (session, status) => {

    var log = {
      clid: session.remote_identity.displayName || session.remote_identity.uri.user,
      user: session.remote_identity.uri.user,
      uri: session.remote_identity.uri.toString(),
      id: session.id,
      time: new Date().getTime()
    };
    var calllogs = JSON.parse(localStorage.getItem('sipCalls') || '{}');

    if (!calllogs) { calllogs = {}; }

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
      calllogs[log.id].startTime = new Date().getTime()
    }

    if (status === 'ended') {
      calllogs[log.id].stop = log.time;
    }


    if (status === 'ended' && (
      calllogs[log.id].status === 'ringing'
      || calllogs[log.id].status === 'waiting'
      || calllogs[log.id].status === 'connecting')) {
      calllogs[log.id].status = 'missed';
    } else {
      calllogs[log.id].status = status;
    }

    localStorage.setItem('sipCalls', JSON.stringify(calllogs));

    this.setState({ calllogs: Object.keys(calllogs).map(e => calllogs[e]).sort((a, b) => b.start - a.start) });
  }

  public render() {
    return React.Children.map(this.props.children, child => {
      if (React.isValidElement(child)) {
        return React.cloneElement<any>(child, {
          sip: {
            ...this.props,
            status: this.state.sipStatus,
            errorType: this.state.sipErrorType,
            errorMessage: this.state.sipErrorMessage,
          },
          call: {
            id: "??",
            status: this.state.callStatus,
            direction: this.state.callDirection,
            counterpart: this.state.callCounterpart,
            calllogs: this.state.calllogs,
            calltype: this.state.calltype,
          },
          action: {
            removeCallLog: this.removeCallLog.bind(this),
            changeMuteAudio: this.changeMuteAudio.bind(this),
            changeMuteVideo: this.changeMuteVideo.bind(this),
            changeHold: this.changeHold.bind(this),
            sendDTMF: this.sendDTMF.bind(this),
          },
          localHold: this.state.localHold,
          remoteHold: this.state.remoteHold,
          muteStatus: this.state.muteStatus,

          rtcSession: this.state.rtcSession,
          registerSip: this.registerSip,
          unregisterSip: this.unregisterSip,

          answerCall: this.answerCall,
          startCall: this.startCall,
          stopCall: this.stopCall
        });
      }
      return child;
    });
  }
}
