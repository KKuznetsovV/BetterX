"use strict";
var SocketMessages;
(function (SocketMessages) {
    SocketMessages["NEW_FOLLOW"] = "NEW_FOLLOW";
    SocketMessages["NEW_POST"] = "NEW_POST";
    SocketMessages["UPDATE_POST"] = "UPDATE_POST";
    SocketMessages["DELETE_POST"] = "DELETE_POST";
    SocketMessages["UNFOLLOW"] = "UNFOLLOW";
    SocketMessages["NEW_COMMENT"] = "NEW_COMMENT";
    SocketMessages["UPDATE_COMMENT"] = "UPDATE_COMMENT";
    SocketMessages["DELETE_COMMENT"] = "DELETE_COMMENT";
    SocketMessages["NEW_PROFILE"] = "NEW_PROFILE";
    SocketMessages["NEW_NOTIFICATION"] = "NEW_NOTIFICATION";
})(SocketMessages || (SocketMessages = {}));
module.exports = SocketMessages;
