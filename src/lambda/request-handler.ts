import generateLambdaProxyResponse from './utils';
import { SocketEvent, Client } from '../models/socket-event';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

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
  try {
    if(val.eventType == "click") {
       response = val;
    } else if (val.eventType == "start-session") {
        response = startSession(response);
    } else if(val.eventType == "register") {
        response = await register(response, val);
    } else {
        console.log("Unrecognized type: " + val.eventType);
        return generateLambdaProxyResponse(500, 'Error');
    }

    const command = new SendMessageCommand({
        QueueUrl: process.env.STATUS_QUEUE_URL,
        MessageBody: JSON.stringify(response),
        MessageAttributes: {
            Type: {
                StringValue: 'SocketEvent',
                DataType: 'String',
            },
        },
    });
    let sqsResults = await SQS.send(command);
    console.log(sqsResults);
} catch (error: any) {
    console.log("Failed to push to SQS");
    var body = error.stack || JSON.stringify(error, null, 2);
    console.log(body);
    return generateLambdaProxyResponse(500, 'Error');
}
  return generateLambdaProxyResponse(200, 'Ok');
}

function startSession(response: SocketEvent) {
    var session_id = crypto.randomBytes(16).toString("hex");
    response.eventType = "set-session-acknowledgement"
    response.eventBody = session_id
    return response
}

async function register(response: SocketEvent, val: SocketEvent) {
    var client = val.eventBody as Client;

        if(client.name) {
            client.state = 2;
            client.waitTime = Date.now();
            const oneHourFromNow = Math.round(Date.now() / 1000 + 3600);
            const roomId = "waitRoom" + client.gameSize;
            console.log(client.sessionId + " changed name to " + client.name);
            console.log(JSON.stringify(client));

            await dynamoDbClient.send(new DeleteCommand({
                TableName: process.env.TABLE_NAME!,
                Key: {
                  connectionId: val.connectionId,
                  roomId: 'DEFAULT',
                },
              }))

            var resp = await dynamoDbClient.send( new PutCommand({
            TableName: process.env.TABLE_NAME!,
            Item: {
                connectionId: val.connectionId,
                roomId: roomId,
                ttl: oneHourFromNow,
                userData: JSON.stringify(client)
            },
            }));

            console.log(resp);
            response.eventType = "joining";
            response.roomId = roomId;
          }
          else {
            console.log("Naming error");
            var msg = "Name cannot be blank";
            response.eventType = "register error";
            response.eventBody = msg;
          }
    return response
}