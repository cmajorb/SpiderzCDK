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
}