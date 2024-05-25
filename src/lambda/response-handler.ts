import { SQSBatchResponse, SQSHandler } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApi, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { SocketEvent } from '../models/socket-event';

const client = new DynamoDBClient({});
const dynamoDbClient = DynamoDBDocumentClient.from(client);

const gatewayClient = new ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.API_GATEWAY_ENDPOINT,
});

async function getConnections(senderConnectionId: string, roomId: string): Promise<any> {
  const { Items: connections } = await dynamoDbClient.send(new QueryCommand({
    TableName: process.env.TABLE_NAME!,
    KeyConditionExpression: 'roomId = :c',
    ExpressionAttributeValues: {
      ':c': roomId,
    },
    ProjectionExpression: 'connectionId',
  }));

  return connections!
    .map((c: any) => c.connectionId)
    .filter((connectionId: string) => connectionId !== senderConnectionId);
}

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
    for (const record of event.Records) {
        const body = JSON.parse(record.body) as SocketEvent;

        try {
            const connections = await getConnections(body.connectionId, body.roomId);

            await Promise.allSettled(connections.map(async connectionId => {
                const command = new PostToConnectionCommand({
                    ConnectionId: connectionId,
                    Data: JSON.stringify(body),
                });
        
                try {
                    await gatewayClient.send(command);
                    console.log("Success");
                } catch (error) {
                    console.error(`Error sending message to connection ${connectionId}:`, error);
                }
            }));
        } catch (error) {
            console.error(`Error processing message`, error);
        }
    }

    // Return empty batch item failures to acknowledge all messages as successfully processed
    return { batchItemFailures: [] };
};