import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayEvent } from 'aws-lambda';
import { SocketEvent } from '../models/socket-event';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

import generateLambdaProxyResponse from './utils';

const client = new DynamoDBClient({});
const dynamoDbClient = DynamoDBDocumentClient.from(client);
const SQS = new SQSClient();

export async function connectionHandler(event: APIGatewayEvent): Promise<any> {
  const { eventType, connectionId } = event.requestContext;

  if (eventType === 'CONNECT') {
    console.log("New connection");

    return generateLambdaProxyResponse(200, 'Connected');
  }

  if (eventType === 'DISCONNECT') {
    console.log("Player disconnected");

    return generateLambdaProxyResponse(200, 'Disconnected');
  }

  return generateLambdaProxyResponse(200, 'Ok');
}