import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayEvent } from 'aws-lambda';
import { SocketEvent } from '../models/socket-event';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

import generateLambdaProxyResponse from './utils';

const AWSXRay = require('aws-xray-sdk-core');

const client = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const dynamoDbClient = DynamoDBDocumentClient.from(client);
const SQS = AWSXRay.captureAWSv3Client(new SQSClient());

export async function connectionHandler(event: APIGatewayEvent): Promise<any> {
  const { eventType, connectionId } = event.requestContext;

  if (eventType === 'CONNECT') {
    const oneHourFromNow = Math.round(Date.now() / 1000 + 3600);
    await dynamoDbClient.send( new PutCommand({
      TableName: process.env.TABLE_NAME!,
      Item: {
        connectionId,
        roomId: 'DEFAULT',
        ttl: oneHourFromNow,
      },
    }));

    try {
        let socketEvent = new SocketEvent({
            connectionId: connectionId,
            eventBody: `New user connected: ${connectionId}`,
            eventDate: new Date()
        });

        const command = new SendMessageCommand({
            QueueUrl: process.env.STATUS_QUEUE_URL,
            MessageBody: JSON.stringify(socketEvent),
            MessageAttributes: {
                Type: {
                    StringValue: 'StatusUpdate',
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

    return generateLambdaProxyResponse(200, 'Connected');
  }

  if (eventType === 'DISCONNECT') {
    await dynamoDbClient.send( new DeleteCommand({
      TableName: process.env.TABLE_NAME!,
      Key: {
        connectionId,
        roomId: 'DEFAULT',
      },
    }));

    try {
        // Prepare status change event for broadcast
        let socketEvent = new SocketEvent({
            connectionId: connectionId,
            eventBody: `User ${connectionId} disconnected`,
            eventDate: new Date()
        });

        const command = new SendMessageCommand({
            QueueUrl: process.env.STATUS_QUEUE_URL,
            MessageBody: JSON.stringify(socketEvent),
            MessageAttributes: {
                Type: {
                    StringValue: 'StatusUpdate',
                    DataType: 'String',
                },
            },
        });

        // Put status change event to SQS queue
        let sqsResults = await SQS.send(command);
        console.log(sqsResults);
    } catch (error: any) {
        console.log("Failed to push to SQS");
        var body = error.stack || JSON.stringify(error, null, 2);
        console.log(body);
        return generateLambdaProxyResponse(500, 'Error');
    }

    return generateLambdaProxyResponse(200, 'Disconnected');
  }

  return generateLambdaProxyResponse(200, 'Ok');
}