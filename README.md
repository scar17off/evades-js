# evades-js / EJS
Node.js library for [Evades.IO](https://evades.io/ "Evades.IO").

Installing: `npm i evades-js`.\
**REQUIRES NODE.JS 12.0+!**

![Nodejs](https://img.shields.io/badge/-Node.js%2012.0%2B-brightgreen?style=for-the-badge&logo=node.js&labelColor=1a1a1a)

# Example
```javascript
const EJS = require("evades-js");
const bot = new EJS.Client({
    username: "your username",
    password: "your password"
});

bot.on("join", () => {
    console.log("Connected! Nickname: " + bot.username);
});
```

# Events
`open` - Opened WebSocket connection.\
`close` - Closed WebSocket connection.\
`join` - Joined to the server.\
`messages` - List of messages sent at the same time.\
`rawMessage` - Returns `"nickname: message"` formatted-message.\
`chatMessage` - Returns ChatMessage class.\
`message` - Decoded WebSocket messages.

# Options
`HeroType (optional)` - Hero type (default: `gameDataProtocol.HeroType.MAGMAX`).\
`wss (optional)` - Hero type (default: `"wss://eu.evades.io/api/game/connect?backend=0&game=0"`).\
`sessionCookie (optional)` - Session cookie for logging in.\
`username, password (optional)` - Account username and password for logging in.\
`server` - Server id. (1, 2, 3, 4)\
`location` - Server location. (eu, us)

### ChatMessage
- `int32` ChatMessage.id
- `string` ChatMessage.sender
- `ChatMessageStyle` ChatMessage.style
- `string` ChatMessage.text
