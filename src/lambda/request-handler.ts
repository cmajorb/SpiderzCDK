import generateLambdaProxyResponse from './utils';
import { SocketEvent, Client, EventType, COLORS } from '../models/socket-event';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { APIGatewayProxyEvent } from 'aws-lambda';
import DynamoDBUtil from '../utilities/dynamo-utility';
import GameUtils from '../utilities/game-utility';

const SQS = new SQSClient();
const dbUtil = new DynamoDBUtil();

export async function handleMessage(event: APIGatewayProxyEvent) {
  console.log('Received event ', event);
  var val = JSON.parse(event.body || "") as SocketEvent;
  val.connectionId = event.requestContext.connectionId!;
  var response = new SocketEvent();
  response.roomId = "DEFAULT";
  response.connectionId = event.requestContext.connectionId!;
  try {
    switch (val.eventType) {
        case EventType.Register:
            response = await register(response, val);
            await sendMessage(response, "RoomMessage");
            break;
        case EventType.StartSession:
            response = await startSession(response, val);
            await sendMessage(response, "ConnectionMessage");
            break;
        case EventType.PlayerConnect:
            response = await playerConnect(response, val)
            await sendMessage(response, "ConnectionMessage");
            break;
        case EventType.MakeMove:
            response = await makeMove(response, val)
            await sendMessage(response, "RoomMessage");
            break;
        default:
            console.log("Unrecognized type: " + val.eventType);
            return generateLambdaProxyResponse(500, 'Error');
    }    
} catch (error: any) {
    console.log("Failed to push to SQS");
    var body = error.stack || JSON.stringify(error, null, 2);
    console.log(body);
    return generateLambdaProxyResponse(500, 'Error');
}
  return generateLambdaProxyResponse(200, 'Ok');
}

async function startSession(response: SocketEvent, val: SocketEvent) {
    console.log("Starting session");
    console.log(val);
    var currentClient = await dbUtil.getClientById(val.eventBody);
    if(currentClient) {
        var resp = await dbUtil.updateConnectionId(currentClient.sessionId, val.connectionId);
        console.log("Client already exists");
        console.log(resp);
    } else {
        console.log("Creating new client");
        var newClient = await dbUtil.createClient(val.connectionId);
        response.eventType = EventType.ConfirmSession;
        response.eventBody = newClient.sessionId;
    }
    
    return response
}


async function register(response: SocketEvent, val: SocketEvent) {
    var client = val.eventBody as Client;
    client.connectionId = val.connectionId;

        if(client.name) {
            const roomId = "waitRoom" + client.gameSize;

            client.state = 2;
            client.waitTime = Date.now();
            
            console.log(client.sessionId + " changed name to " + client.name);
            console.log(JSON.stringify(client));
            var resp = await dbUtil.changeRoomAndUpdateName(client.sessionId, roomId, client.name);
            console.log(resp);
         
            var clientsAvailable = await dbUtil.getClientsByRoom(roomId, +client.gameSize);
            if(clientsAvailable.length == client.gameSize) {
                const newRoomId = await dbUtil.createRoom(clientsAvailable);
                response.eventType = EventType.Paired;
                response.eventBody = newRoomId;
                response.roomId = newRoomId;
            } else {
                response.eventType = EventType.Joining;
                response.eventBody = 'Joining game (' + clientsAvailable.length  + '/' + client.gameSize + ' players)';
                console.log(response.eventBody);
                response.roomId = roomId;
            }
          }
          else {
            console.log("Naming error");
            var msg = "Name cannot be blank";
            response.eventType = EventType.RegisterError;
            response.eventBody = msg;
            response.roomId = "DEFAULT"
          }
    return response
}

async function sendMessage(message: SocketEvent, type) {
    if(message.eventType != EventType.NoResponse) {
        console.log("Sending the following message:");
        console.log(JSON.stringify(message));
        const command = new SendMessageCommand({
            QueueUrl: process.env.STATUS_QUEUE_URL,
            MessageBody: JSON.stringify(message),
            MessageAttributes: {
                Type: {
                    StringValue: type,
                    DataType: 'String',
                },
            },
        });
        let sqsResults = await SQS.send(command);
        console.log(sqsResults);
    } else {
        console.log("Not sending message");
    }
    
}

async function playerConnect(response: SocketEvent, val: SocketEvent): Promise<SocketEvent> {
    //verify the user
    console.log("Player connect");
    console.log(val);

    const gameObject = await dbUtil.getGameById(val.roomId);

    var resp = await dbUtil.changeRooms(val.eventBody, val.roomId);
    console.log(resp);

    var validNodes = GameUtils.getValidMoves(gameObject.gameData.currentPlayer.position,gameObject.gameData.edges);
    gameObject.gameData.nodes = gameObject.gameData.nodes.concat(validNodes);
    
    response.eventType = EventType.InitGame;
    response.eventBody = gameObject;
    response.roomId = gameObject.gameId;
    return response;
}

async function makeMove(response: SocketEvent, val: SocketEvent): Promise<SocketEvent> {
    //Right now we are just trusting the value of the sessionID that clients send

    var gameObject = await dbUtil.getGameById(val.roomId);
    var selectedNode = val.eventBody as number;
    const currentPlayerIndex = gameObject.gameData.turnCount % gameObject.gameData.playerData.length;

    if(val.sessionId == gameObject.gameData.playerData[currentPlayerIndex].id && GameUtils.checkAdjacent(gameObject.gameData.playerData[currentPlayerIndex].position, selectedNode, gameObject.gameData.edges)) {
        gameObject.gameData.playerData[currentPlayerIndex].position = selectedNode;

        gameObject.gameData.edges = GameUtils.removeEdge(selectedNode,gameObject.gameData.edges);
        gameObject.gameData.nodes.push([selectedNode,COLORS[currentPlayerIndex]]);
        if(selectedNode == 999) {
        //   room.statsData.winners.push(gameObject.gameData.sCurrentPlayer.number)
          gameObject.gameData.winner = gameObject.gameData.currentPlayer.name;
        }
        gameObject = GameUtils.updateGameState(gameObject);
  
        await dbUtil.updateGame(gameObject);

        var validNodes = GameUtils.getValidMoves(gameObject.gameData.currentPlayer.position,gameObject.gameData.edges);
        gameObject.gameData.nodes = gameObject.gameData.nodes.concat(validNodes);
    } else {
        console.log("Not a valid move");
        response.eventType = EventType.NoResponse;
        return response;
    }
    
    response.eventType = EventType.State;
    response.eventBody = gameObject;
    response.roomId = gameObject.gameId;
    return response;
}