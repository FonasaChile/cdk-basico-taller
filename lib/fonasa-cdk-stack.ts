import * as cdk from 'aws-cdk-lib';
import { Construct, DependencyGroup } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { PolicyStatement, Role, ServicePrincipal, ManagedPolicy, Policy } from 'aws-cdk-lib/aws-iam';
import * as rds from "aws-cdk-lib/aws-rds";
import {Secret}  from "aws-cdk-lib/aws-secretsmanager";
import { CfnOutput } from 'aws-cdk-lib';

export class FonasaCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fonasaVpc = new ec2.Vpc(this, "FonasaVpc", {
      cidr: "10.0.0.0/16",
      maxAzs: 2,
      natGateways: 1,
      enableDnsHostnames: true,
      enableDnsSupport: true,
     
      subnetConfiguration: [{
        cidrMask: 24,
        name: 'privateSubnets',
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }, {
        cidrMask: 24,
        name: 'dmz',
        subnetType: ec2.SubnetType.PUBLIC,
      }],
    });
    
    const secret = new Secret(this, "DatabaseCredentials", {
      generateSecretString: {
        excludePunctuation: true,
        secretStringTemplate: JSON.stringify({
          username: 'dbadmin',
        }),
        generateStringKey: "password",
      },
    });
    
    new CfnOutput(this, "secretName", { value: secret.secretArn });
    
    const dbSecGroup = new ec2.SecurityGroup(this, 'db-security-group', {
        vpc: fonasaVpc,
        allowAllOutbound: true,
        description: 'DB Security Group'
    });
    
    dbSecGroup.addIngressRule(ec2.Peer.ipv4(fonasaVpc.vpcCidrBlock), ec2.Port.tcp(5432), 'PostgresSQL rule');
    
    const dbCluster = new rds.DatabaseCluster(this, 'pgdb', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_2,
      }),
      credentials: rds.Credentials.fromSecret(secret), 
      instanceProps: {
        // optional , defaults to t3.medium
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.BURSTABLE3,
          ec2.InstanceSize.LARGE
        ),
        vpc: fonasaVpc,
        securityGroups: [dbSecGroup],
        enablePerformanceInsights: true,
        publiclyAccessible: false
      },
      
      vpcSubnets: {subnetGroupName: "privateSubnets"},
      defaultDatabaseName: 'pgdb',
      storageEncrypted: true,
    });
    
    const fargateDependencies = new DependencyGroup();
    fargateDependencies.add(secret);
    fargateDependencies.add(dbCluster);
    
       
    const clusterCustomImage = new ecs.Cluster(this, "MyVpcClusterCustomImage", {
      vpc: fonasaVpc
    });
    
    const fargateTaskPolicy = new PolicyStatement({
      actions: ['secretsmanager:*'],
      resources: ['*'],
    });
    
    const loadBalancedFargateServiceCustomImage = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "MyVpcFargateServiceCustomImage", {
      cluster: clusterCustomImage, // Required
      assignPublicIp: false, 
      cpu: 256, // Default is 256
      desiredCount: 2, // Default is 1
      taskImageOptions: { image: ecs.ContainerImage.fromAsset("./DockerImage"), environment: {SECRETARN: secret.secretArn}, },
      taskSubnets: {subnetGroupName: "privateSubnets"},
      memoryLimitMiB: 1024, // Default is 512
      publicLoadBalancer: true // Default is true
    });
    
    loadBalancedFargateServiceCustomImage.node.addDependency(fargateDependencies);
    
    loadBalancedFargateServiceCustomImage.taskDefinition.taskRole.attachInlinePolicy(new Policy(this, 'fargate-task-policy', {
        statements: [fargateTaskPolicy],
      }));
    
    const scalableTargetCustomImage = loadBalancedFargateServiceCustomImage.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 20,
    });
    
    scalableTargetCustomImage.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
    });
    
    scalableTargetCustomImage.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 50,
    });
    
    
  }
}
