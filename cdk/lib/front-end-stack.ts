import { Construct } from 'constructs';
import {Bucket, BucketAccessControl} from 'aws-cdk-lib/aws-s3';
import {BucketDeployment, Source} from 'aws-cdk-lib/aws-s3-deployment';
import {Distribution, OriginAccessIdentity, SecurityPolicyProtocol} from 'aws-cdk-lib/aws-cloudfront';
import {S3Origin} from 'aws-cdk-lib/aws-cloudfront-origins';

import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { HostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';

import path = require('path');

export class FrontEndStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domainName = 'cmajorb.com';
    const siteDomain = 'www.' + domainName;


    const zone = HostedZone.fromLookup(this, 'Zone', { domainName: domainName });
    console.log(zone);
    
    const certificate = new Certificate( this, "certificate", {
      domainName: domainName,
      subjectAlternativeNames: ['*.' + domainName],
      validation: CertificateValidation.fromDns( zone )
    });


    certificate.applyRemovalPolicy(RemovalPolicy.DESTROY)
    new CfnOutput(this, 'Certificate', { value: certificate.certificateArn });

    const sourceBucket = new Bucket(this, 'SourceBucket', {
      accessControl: BucketAccessControl.PRIVATE,
    });

    new BucketDeployment(this, 'BucketDeployment', {
      destinationBucket: sourceBucket,
      sources: [Source.asset(path.resolve(__dirname, '../../src/static'))]
    });

    const originAccessIdentity = new OriginAccessIdentity(this, 'OriginAccessIdentity');
    sourceBucket.grantRead(originAccessIdentity);

    const distribution = new Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new S3Origin(sourceBucket, {originAccessIdentity}),
      },
      certificate: certificate,
      domainNames: [siteDomain, domainName],
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
    })

    new ARecord(this, 'WWWSiteAliasRecord', {
      zone,
      recordName: siteDomain,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
    });

    new ARecord(this, 'SiteAliasRecord', {
      zone,
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
    });

  }
}