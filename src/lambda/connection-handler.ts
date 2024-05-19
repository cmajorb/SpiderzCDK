import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
// eslint-disable-next-line import/no-unresolved
import { APIGatewayEvent } from 'aws-lambda';

import generateLambdaProxyResponse from './utils';

const AWSXRay = require('aws-xray-sdk-core');

const client = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const dynamoDbClient = DynamoDBDocumentClient.from(client);

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
    console.log("CONNECT!");
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
    console.log("DISCONNECT!");
    return generateLambdaProxyResponse(200, 'Disconnected');
  }

  return generateLambdaProxyResponse(200, 'Ok');
}