"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PropTypes = require("prop-types");
exports.extraHeadersPropType = PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string));
exports.iceServersPropType = PropTypes.arrayOf(PropTypes.object);
exports.sipPropType = PropTypes.shape({
    status: PropTypes.string,
    errorType: PropTypes.string,
    errorMessage: PropTypes.string,
    host: PropTypes.string,
    port: PropTypes.number,
    user: PropTypes.string,
    password: PropTypes.string,
    autoRegister: PropTypes.bool,
    autoAnswer: PropTypes.bool,
    sessionTimersExpires: PropTypes.number,
    extraHeaders: exports.extraHeadersPropType,
    iceServers: exports.iceServersPropType,
    debug: PropTypes.bool,
});
exports.callPropType = PropTypes.shape({
    id: PropTypes.string,
    status: PropTypes.string,
    direction: PropTypes.string,
    counterpart: PropTypes.string,
});
exports.muteStatusPropType = PropTypes.shape({
    audio: PropTypes.bool,
    video: PropTypes.bool,
});
//# sourceMappingURL=types.js.map