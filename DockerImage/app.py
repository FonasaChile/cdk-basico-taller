import boto3
import psycopg2
import json
from flask import Flask
app = Flask(__name__)

#s3 = boto3.client('s3')
secretsClient = boto3.client('secretsmanager',region_name='us-west-2')
cf_client = boto3.client('cloudformation',region_name='us-west-2')
cf_stackname = 'FonasaCdkStack'
cf_response = cf_client.describe_stacks(StackName=cf_stackname)
cf_outputs = cf_response["Stacks"][0]["Outputs"]
for output in cf_outputs:
    keyName = output["OutputKey"]
    if keyName == "secretName":
        cf_secret_name = output["OutputValue"]


@app.route('/')
def hello():
	response = secretsClient.get_secret_value(SecretId=cf_secret_name)
	jsonResponse = json.loads(response['SecretString'])
	
	conn = psycopg2.connect(database=jsonResponse['dbname'],host=jsonResponse['host'],user=jsonResponse['username'],password=jsonResponse['password'],port=jsonResponse['port'])
	cursor = conn.cursor()
	cursor.execute("SELECT CURRENT_TIMESTAMP;")
	pgTime = cursor.fetchone()[0]
	conn.close()
	return pgTime.strftime('%Y-%m-%d %H:%M:%S')

if __name__ == '__main__':
	app.run(host='0.0.0.0', port=80)
