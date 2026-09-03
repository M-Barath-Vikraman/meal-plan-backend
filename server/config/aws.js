import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

if (!process.env.AWS_PROFILE) {
  process.env.AWS_PROFILE = 'smartmeal-local';
}

const region = process.env.AWS_REGION || 'ap-south-1';

// Initialize low-level DynamoDB Client using AWS SDK default credential provider chain
const ddbClient = new DynamoDBClient({ region });

// Initialize DynamoDBDocumentClient for simplified JS object marshalling/unmarshalling
export const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const FOODS_TABLE = process.env.DYNAMODB_FOODS_TABLE || 'smartmeal-foods';
export const PLANS_TABLE = process.env.DYNAMODB_PLANS_TABLE || 'smartmeal-plans';
