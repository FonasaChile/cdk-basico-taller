import boto3
import os
import psycopg2
import json
from flask import Flask
app = Flask(__name__)

#s3 = boto3.client('s3')
secretsClient = boto3.client('secretsmanager',region_name='us-west-2')
print("Secret ARN = " + os.environ['SECRETARN'])

@app.route('/')
def hello():
	response = secretsClient.get_secret_value(SecretId=os.environ['SECRETARN'])
	jsonResponse = json.loads(response['SecretString'])
	
	conn = psycopg2.connect(database=jsonResponse['dbname'],host=jsonResponse['host'],user=jsonResponse['username'],password=jsonResponse['password'],port=jsonResponse['port'])
	cursor = conn.cursor()
	cursor.execute("SELECT CURRENT_TIMESTAMP;")
	pgTime = cursor.fetchone()[0]
	conn.close()
	return pgTime.strftime('%Y-%m-%d %H:%M:%S')

if __name__ == '__main__':
	app.run(host='0.0.0.0', port=80)
