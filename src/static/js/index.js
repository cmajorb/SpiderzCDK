const socket = new WebSocket('wss://2n41eynmpl.execute-api.us-east-1.amazonaws.com/play');

const EventType = {
    RegisterError: "register error",
    Joining: "joining",
    ConfirmSession: "confirm session",
    Paired: "paired",
    Register: "register",
    StartSession: "start-session"
}

let sessionId = sessionStorage.getItem('sessionId');
document.getElementById("name").value = sessionStorage.getItem('name');

function startGame() {
    var name = document.getElementById("name").value;
    var gameSize = document.getElementById("gameSize").value
    sessionStorage.setItem('name', name);
    socket.send(JSON.stringify({
        "eventType": EventType.Register,
        "eventBody": {
            "name": name,
            "gameSize": gameSize,
            "sessionId": sessionId
        }
    }))
}


socket.addEventListener('open', (event) => {
    console.log('WebSocket is open now.');
    console.log(sessionId);
    socket.send(JSON.stringify({ "eventType": EventType.StartSession, "eventBody": sessionId }))
});

socket.addEventListener('message', (event) => {
    var message = JSON.parse(event.data);
    console.log(message);

    switch (message.eventType) {
        case EventType.RegisterError:
            document.getElementById("error-msg").innerHTML = message.eventBody;
            break;

        case EventType.ConfirmSession:
            console.log("got session set event: " + message.eventBody);
            sessionId = message.eventBody;
            sessionStorage.setItem('sessionId', sessionId);
            break;

        case EventType.Joining:
            document.getElementById("loading").style.display = "block";
            document.getElementById("myForm").style.display = "none";
            if (message.eventBody !== undefined) {
                document.getElementById("status").innerHTML = message.eventBody;
            }
            console.log("joining");
            break;

        case EventType.Paired:
            console.log("Saving game ID: " + message.eventBody);
            sessionStorage.setItem('gameId', message.eventBody);
            window.location.href = "/game.html";
            break;

        default:
            console.log("Unknown event type: " + message.eventType);
    }
});

socket.addEventListener('close', (event) => {
    console.log('WebSocket is closed now.');
    // Handle the close event here
});