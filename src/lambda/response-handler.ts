import { SQSBatchResponse, SQSHandler } from 'aws-lambda';
import { ApiGatewayManagementApi, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { SocketEvent } from '../models/socket-event';
import DynamoDBUtil from '../utilities/dynamo-utility';

const dbUtil = new DynamoDBUtil();

const gatewayClient = new ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.API_GATEWAY_ENDPOINT,
});

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
    for (const record of event.Records) {
        console.log("RECORD:");
        console.log(JSON.stringify(record));
        const body = JSON.parse(record.body) as SocketEvent;

        try {
            if(record.messageAttributes.Type.stringValue == "RoomMessage") {
                console.log("sending room message");
                const connections = await dbUtil.getConnections(body.connectionId, body.roomId);

                await Promise.allSettled(connections.map(async connection => {
                    const command = new PostToConnectionCommand({
                        ConnectionId: connection.connectionId,
                        Data: JSON.stringify(body),
                    });
            
                    try {
                        await gatewayClient.send(command);
                        console.log("Successfully sent to " + connection.sessionId);
                    } catch (error) {
                        await dbUtil.deactivateConnection(connection.sessionId)
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