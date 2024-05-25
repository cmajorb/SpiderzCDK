
const socket = new WebSocket('wss://xtmalx2w47.execute-api.us-east-1.amazonaws.com/play');


let sessionId = sessionStorage.getItem('sessionId');
document.getElementById("name").value = sessionStorage.getItem('name');

function startGame() {
  var name = document.getElementById("name").value;
  var gameSize = document.getElementById("gameSize").value
  sessionStorage.setItem('name', name);
  socket.send(JSON.stringify({"eventType":"register",
  "eventBody": {
    "name": name,
    "gameSize": gameSize,
    "sessionId": sessionId
  }}))
}


socket.addEventListener('open', (event) => {
    console.log('WebSocket is open now.');
    console.log(sessionId);
    socket.send(JSON.stringify({"eventType":"start-session","eventBody": sessionId}))
});

socket.addEventListener('message', (event) => {
    var message = JSON.parse(event.data);
    console.log(message);
    if(message.eventType == "register error") {
        document.getElementById("error-msg").innerHTML = message.eventBody;
    } else if (message.eventType == "set-session-acknowledgement") {
        sessionId = message.eventBody;
        sessionStorage.setItem('sessionId', sessionId);
    }
});

socket.addEventListener('close', (event) => {
    console.log('WebSocket is closed now.');
    // Handle the close event here
});