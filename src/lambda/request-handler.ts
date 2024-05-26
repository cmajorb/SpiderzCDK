import generateLambdaProxyResponse from './utils';
import { SocketEvent, Client, DBClient } from '../models/socket-event';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const SQS = new SQSClient();
const crypto = require("crypto");
const client = new DynamoDBClient({});
const dynamoDbClient = DynamoDBDocumentClient.from(client);

export async function handleMessage(event: APIGatewayProxyEvent) {
  console.log('Received event ', event);
  var val = JSON.parse(event.body || "") as SocketEvent;
  val.connectionId = event.requestContext.connectionId!;
  var response = new SocketEvent();
  response.roomId = "DEFAULT";
  response.connectionId = event.requestContext.connectionId!;
  try {
    if(val.eventType == "click") {
       response = val;
    } else if (val.eventType == "start-session") {
        response = await startSession(response, val);
        await sendMessage(response, "ConnectionMessage");
    } else if(val.eventType == "register") {
        response = await register(response, val);
        await sendMessage(response, "RoomMessage");
    } else {
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
    var currentClient = await getClientById(val.eventBody);
    if(currentClient) {
        var resp = await updateConnectionId(currentClient.sessionId, val.connectionId);
        console.log("Client already exists");
        console.log(resp);
    } else {
        console.log("Creating new client");
        var newClient = await createClient(val.connectionId);
        response.eventType = "set-session-acknowledgement"
        response.eventBody = newClient.sessionId;
    }
    
    return response
}

async function updateConnectionId(sessionId, connectionId) {
    var resp = await dynamoDbClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME!,
            Key: {
                sessionId: sessionId
            },
            UpdateExpression: "set connectionId = :con",
            ExpressionAttributeValues: {
            ":con": connectionId,
            },
            ReturnValues: "ALL_NEW",
        }));
        return resp;
}

async function register(response: SocketEvent, val: SocketEvent) {
    var client = val.eventBody as Client;
    client.connectionId = val.connectionId;

        if(client.name) {
            client.state = 2;
            client.waitTime = Date.now();
            
            const roomId = "waitRoom" + client.gameSize;
            console.log(client.sessionId + " changed name to " + client.name);
            console.log(JSON.stringify(client));
            var resp = await changeRooms(client, roomId);
            console.log(resp);
            const { Items: waitingRoomConnections } = await dynamoDbClient.send(new QueryCommand({
                TableName: process.env.TABLE_NAME!,
                IndexName: 'connections-by-room-id',
                KeyConditionExpression: 'roomId = :c',
                ExpressionAttributeValues: {
                  ':c': roomId,
                },
                ProjectionExpression: 'sessionId',
                Limit: +client.gameSize
              }));
              console.log("DONE!");
              console.log(waitingRoomConnections);
              const clients: String[] = waitingRoomConnections as String[];
              console.log(clients);
              var numOfPlayers = clients.length;
            
            response.eventType = "joining";
            response.eventBody = 'Joining game (' + numOfPlayers + '/' + client.gameSize + ' players)';
            console.log(response.eventBody);
            response.roomId = roomId;
          }
          else {
            console.log("Naming error");
            var msg = "Name cannot be blank";
            response.eventType = "register error";
            response.eventBody = msg;
            response.roomId = "DEFAULT"
          }
    return response
}

async function getClientById(sessionId):Promise<DBClient|undefined> {
    if(sessionId == null) {
        return;
    }
    const { Items: results } = await dynamoDbClient.send(new QueryCommand({
        TableName: process.env.TABLE_NAME!,
        KeyConditionExpression: 'sessionId = :c',
        ExpressionAttributeValues: {
          ':c': sessionId,
        },
        // ProjectionExpression: 'connectionId',
        Limit: 1
      }));

      const clients: DBClient[] = results as DBClient[];
      return clients[0]
}

async function createClient(connectionId) {
    var newClient = new Client();
    newClient.sessionId = crypto.randomBytes(16).toString("hex");
    newClient.connectionId = connectionId;
    newClient.state = 1;
    console.log("creating new client:");
    console.log(newClient);

    const oneHourFromNow = Math.round(Date.now() / 1000 + 3600);
    await dynamoDbClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME!,
      Item: {
        sessionId: newClient.sessionId,
        roomId: 'DEFAULT',
        connectionId: connectionId,
        ttl: oneHourFromNow,
      },
    }));


    return newClient;
}

async function sendMessage(message, type) {
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
}

async function changeRooms(client: Client, newRoom) {
    var resp = await dynamoDbClient.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME!,
        Key: {
            sessionId: client.sessionId
        },
        UpdateExpression: "set roomId = :room",
        ExpressionAttributeValues: {
            ":room": newRoom,
        },
        ReturnValues: "ALL_NEW",
    }));
    return resp;
}