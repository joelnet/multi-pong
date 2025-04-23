# Multi Pong

A multi-player pong game built with HTML, CSS, and JavaScript without a game server.

## Networking

There is no game server. Clients connect to each other and exchange messages using WebRTC with manual signaling.

The manual signaling data exchange is done through (1) a QR code or (2) copy and paste.

### Connecting Clients

One client acts as a Host and the other client act as Guest.

Both Host and Guest load the page in their browser. The Host will click Host and the Guest will click Guest.

The Host screen will show a QR Code and a textbox showing th offer data. The Guest will click Guest and either scan the QR Code (with the built in QR Code scanner) or paste the offer data from the Host's screen.

After the Guest app accepts the offer data, it will generate an answer data to send to the Host. This method is the same, but in reverse. The Guest screen will show a QR Code and a textbox showing the answer data.

The Host must now scan the QR Code on the Guest's screen or paste the answer data from the Guest's screen.

At this point, both Host and Guest should be connected and a ping/pong message exchange should begin.

Both Host and Guest will now see a Connection Success message and have a button to start the game.

### Message Exchange

After a volley, the angle and velocity of the ball will be sent to the other client. This way both Host and Guest can render the ball in their respective screens.

The client receiving the ball will be the source of truth for the returning balls velocity and angle. This way no latency or packet loss will affect the game.

## Gameplay

The gameplay is classic pong.

The ball velocity will increase with each volley. This is configurable in the settings.json.

### Score

The score is displayed in the top left of the screen. The first player to score 3 points wins the game. This is configurable in the settings.json.

### Visuals

The game should be built with a dark neon theme reminiscent of Tron with glowing elements. When the ball is returned there are particle effects and screen shakes and sound effects to make the experience more immersive.
