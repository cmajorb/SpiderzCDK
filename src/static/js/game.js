const socket = new WebSocket('wss://2n41eynmpl.execute-api.us-east-1.amazonaws.com/play');
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
var size;
var gapSize;
var midX = 350;
var midY = 350;
var sections;
var randomDensity;
var tiles = [];
var spiderSize;
var centerColor;
var playerData;
var gameState;

const spider = new Image();
const spiderSelected = new Image();
spider.src = "/src/static/images/spider.png";
spiderSelected.src = "/src/static/images/spider_selected.png";

const EventType = {
    State: "state",
    Joining: "joining",
    ConfirmSession: "confirm session",
    Paired: "paired",
    Register: "register",
    StartSession: "start-session",
    PlayerConnect: "player connect",
    StartGame: "start game",
    InitGame: "init"
}

let sessionId = sessionStorage.getItem('sessionId');
let gameId = sessionStorage.getItem('gameId');

canvas.addEventListener("click", clickEvent);


socket.addEventListener('open', (event) => {
    console.log('WebSocket is open now.');
    console.log(sessionId);
    socket.send(JSON.stringify({ "eventType": EventType.StartSession, "eventBody": sessionId }))
    socket.send(JSON.stringify({ "eventType": EventType.PlayerConnect, "eventBody": sessionId, "roomId": gameId }))
});

socket.addEventListener('message', (event) => {
    var message = JSON.parse(event.data);
    console.log(message);

    switch (message.eventType) {
        case EventType.InitGame:
            var body = JSON.parse(message.eventBody);
            var gameData = body.gameData;
            console.log("Init event: ");
            console.log(gameData);

            tiles = gameData.nodes;
            gameState = gameData.gameState;
            players = gameData.playerData;
            winner = gameData.winner;

            size = body.canvasData.Size;
            gapSize = body.canvasData.GapSize;
            sections = body.canvasData.Sections;
            randomDensity = body.canvasData.RandomDensity;
            spiderSize = body.canvasData.SpiderSize;
            drawGrid();
            break;
        case EventType.State:
            var body = JSON.parse(message.eventBody);
            var gameData = body.gameData;
            console.log("State event: ");
            console.log(message.eventBody);
            console.log(gameData);
            tiles = gameData.nodes;
            gameState = gameData.gameState;
            players = gameData.playerData;
            winner = gameData.winner;
            drawGrid();
            break;
        default:
            console.log("Unknown event type: " + message.eventType);
    }
});

socket.addEventListener('close', (event) => {
    console.log('WebSocket is closed now.');
    // Handle the close event here
});

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
}

function clickEvent(e) {
    var coor = getMousePos(canvas,e);
    var cursorY = midY-coor.y;
    var cursorX = midX-coor.x;
    var polar = cartesian2Polar(cursorX,cursorY);
    console.log(polar);
    // socket.emit('click',polar,sessionId);
  }

function cartesian2Polar(x,y){
    distance = Math.floor(Math.sqrt(x*x + y*y)/gapSize);
    radians = Math.floor(((Math.atan2(y,x)+Math.PI)/Math.PI)*(sections/2)); //This takes y first
    polarCoor = { distance:distance, radians:radians }
    return polarCoor
}

function Polar2cartesian(r,angle){
    angle = angle+0.5;
    r = r+0.5;
    var x = r*gapSize*Math.cos((Math.PI/(sections/2))*angle)+midX;
    var y = r*gapSize*Math.sin((Math.PI/(sections/2))*angle)+midY;
    cartesianCoor = { x:x, y:y }
    return cartesianCoor
}
function id2Cartesian(id) {
  if(id==999) {
    return(Polar2cartesian(0,0));
  }
  var r = Math.floor((id-1)/sections)+1;
  var t = (id-1)%sections;
  return Polar2cartesian(r,t);
}

function drawGrid(){
    var rings = size+1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(midX, midY, gapSize*rings, 0, Math.PI*2, false);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.closePath();
  
    for(var i =0; i<=rings; i++) {
      ctx.beginPath();
      ctx.arc(midX, midY, gapSize*i, 0, Math.PI*2, false);
      ctx.stroke();
      ctx.closePath();
    }
    ctx.beginPath();
    for(var i=0; i<(sections/2);i++) {
      ctx.moveTo(rings*gapSize*Math.cos((Math.PI/(sections/2))*i)+midX,rings*gapSize*Math.sin((Math.PI/(sections/2))*i)+midY);
      ctx.lineTo(rings*gapSize*Math.cos((Math.PI/(sections/2))*i+Math.PI)+midX,rings*gapSize*Math.sin((Math.PI/(sections/2))*i+Math.PI)+midY);
    }
    ctx.stroke();
  
    ctx.beginPath();
    ctx.arc(midX, midY, gapSize, 0, Math.PI*2, false);
    ctx.fillStyle = 'green';
    ctx.fill();
    ctx.closePath();
  
    for(var i = 0; i<tiles.length; i++) {
      if(tiles[i][0]==999) {
        ctx.beginPath();
        ctx.arc(midX, midY, gapSize, 0, Math.PI*2, false);
        ctx.lineWidth = 8;
        ctx.strokeStyle = tiles[i][1];
        ctx.stroke();
        ctx.closePath();
      }
      var r = Math.floor((tiles[i][0]-1)/sections)+1;
      var t = (tiles[i][0]-1)%sections;
      ctx.strokeStyle = tiles[i][1];
      ctx.lineWidth = gapSize;
      ctx.beginPath();
      ctx.arc(midX, midY, gapSize*r+gapSize/2, (Math.PI/(sections/2))*t, (Math.PI/(sections/2))*t+(Math.PI/(sections/2)), false);
      ctx.stroke();
      ctx.closePath();
    }
  
    for(var i = 0;i<players.length;i++) {
      var image = spider;
      if(players[i].activeTurn == true) {
        image = spiderSelected;
      }
      var coor = id2Cartesian(players[i].position);
      var position = [coor.x-gapSize*(spiderSize/2),coor.y-gapSize*(spiderSize/2),gapSize*spiderSize,gapSize*spiderSize];
      if(players[i].position==0) {
        position = [0+i*gapSize*spiderSize,0,gapSize*spiderSize,gapSize*spiderSize];
      }
      ctx.drawImage(image, position[0],position[1],position[2],position[3]);
      ctx.textAlign = "center";
      ctx.fillStyle = "black";
      ctx.font = "12px Arial";
      ctx.fillText(players[i].name, position[0]+(gapSize*spiderSize)/2,position[1]+(gapSize*spiderSize*0.85));
    }
  }