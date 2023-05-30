const Pusher = require('pusher');

const pusher = new Pusher({
    appId: "1607959",
    key: "3f69ba6228294488c42c",
    secret: "a080e6b436d1939bf11c",
    cluster: "ap1",
    useTLS: true
});

module.exports = pusher;