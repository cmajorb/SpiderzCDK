// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Payload } from "./payload"

export class SocketEvent extends Payload {
    constructor(init?:Partial<SocketEvent>) {
        super("SocketEvent");
        Object.assign(this, init);
    } 
    public connectionId!: string;
    public eventType!: string;
    public eventBody!: Object;
    public eventDate!: Date;
    public roomId!: string;
}

export class Client {
    public name!: string;
    public sessionId!: string;
    public gameSize!: number;
    public state!: number;
    public waitTime!: number;
}