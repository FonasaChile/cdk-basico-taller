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

    const mohVpc = new ec2.Vpc(this, "FonasaVpc", {
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
    
    const secretDependency = new DependencyGroup();
    secretDependency.add(secret);
    
       
    const clusterCustomImage = new ecs.Cluster(this, "MyVpcClusterCustomImage", {
      vpc: mohVpc
    });
    
    const fargateTaskPolicy = new PolicyStatement({
      actions: ['secretsmanager:*', 's3:*','cloudformation:*'],
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
    
    loadBalancedFargateServiceCustomImage.node.addDependency(secretDependency);
    
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
    
    

    
    const dbSecGroup = new ec2.SecurityGroup(this, 'db-security-group', {
        vpc: mohVpc,
        allowAllOutbound: true,
        description: 'DB Security Group'
    });
    
    dbSecGroup.addIngressRule(ec2.Peer.ipv4(mohVpc.vpcCidrBlock), ec2.Port.tcp(5432), 'PostgresSQL rule');
    
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
        vpc: mohVpc,
        securityGroups: [dbSecGroup],
        enablePerformanceInsights: true,
        publiclyAccessible: false
      },
      
      vpcSubnets: {subnetGroupName: "privateSubnets"},
      defaultDatabaseName: 'pgdb',
      storageEncrypted: true,
    });
  }
}
