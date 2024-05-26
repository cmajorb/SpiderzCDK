import { SQSBatchResponse, SQSHandler } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApi, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { SocketEvent, DBClient } from '../models/socket-event';

const client = new DynamoDBClient({});
const dynamoDbClient = DynamoDBDocumentClient.from(client);

const gatewayClient = new ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.API_GATEWAY_ENDPOINT,
});

async function deactivateConnection(sessionId: string): Promise<any> {
    console.log("Deactiving " + sessionId);
    var resp = await dynamoDbClient.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME!,
        Key: {
            sessionId: sessionId
        },
        UpdateExpression: "set roomId = :room",
        ExpressionAttributeValues: {
            ":room": "INACTIVE",
        },
        ReturnValues: "ALL_NEW",
    }));
    console.log(resp);
    return resp;
  }

async function getConnections(senderConnectionId: string, roomId: string): Promise<DBClient[]> {
  const { Items: connections } = await dynamoDbClient.send(new QueryCommand({
    TableName: process.env.TABLE_NAME!,
    IndexName: 'connections-by-room-id',
    KeyConditionExpression: 'roomId = :c',
    ExpressionAttributeValues: {
      ':c': roomId,
    },
    ProjectionExpression: 'connectionId, sessionId',
  }));
  return connections as DBClient[];
    // .map((c: any) => c.connectionId);
    // .filter((connectionId: string) => connectionId !== senderConnectionId);
}

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
    for (const record of event.Records) {
        console.log("RECORD:");
        console.log(JSON.stringify(record));
        const body = JSON.parse(record.body) as SocketEvent;

        try {
            if(record.messageAttributes.Type.stringValue == "RoomMessage") {
                const connections = await getConnections(body.connectionId, body.roomId);

                await Promise.allSettled(connections.map(async connection => {
                    const command = new PostToConnectionCommand({
                        ConnectionId: connection.connectionId,
                        Data: JSON.stringify(body),
                    });
            
                    try {
                        await gatewayClient.send(command);
                        console.log("Success");
                    } catch (error) {
                        await deactivateConnection(connection.sessionId)
                        console.error(`Error sending message to connection ${connection.connectionId}:`, error);
                    }
                }));
            } else {
                const command = new PostToConnectionCommand({
                    ConnectionId: body.connectionId,
                    Data: JSON.stringify(body),
                });
                try {
                    await gatewayClient.send(command);
                    console.log("Success");
                } catch (error) {
                    // await deactivateConnection(connection.sessionId)
                    console.error(`Error sending message to connection ${body.connectionId}:`, error);
                }
            }
     
        } catch (error) {
            console.error(`Error processing message`, error);
        }
    }

    // Return empty batch item failures to acknowledge all messages as successfully processed
    return { batchItemFailures: [] };
};