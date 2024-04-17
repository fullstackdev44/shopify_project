const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors'); // Import the cors middleware
const app = express();
const port = process.env.PORT || 4000;
// Set up multer to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
const credentials = new AWS.Credentials({
  accessKeyId:  process.env.ACCESS_KEY_ID, 
  secretAccessKey:  process.env.SECRET_ACCESS_KEY, 
});


AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION, 
});

const s3 = new AWS.S3();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const lambdaFunctions = [
  'lambda_instance_1',
  'lambda_instance_2',
  'lambda_instance_3',
  'lambda_instance_4',
  'lambda_instance_5',
  'lambda_instance_6'
];
app.post('/upload', async (req, res) => {
  try {
    const base64Image = req.body.file;
    if (!base64Image) {
      throw new Error('Image data is missing in the request body');
    }
    const current_date = new Date();
    const formatted_date = current_date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const bucket_name = 'pp-unprocessed-images';

    const base64_image = base64Image;
    const image_data = Buffer.from(base64_image, 'base64');

    const key = `${formatted_date}/${Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000}-${Math.floor(new Date() / 1000)}.jpg`;

    await s3.putObject({
      Body: image_data,
      Bucket: bucket_name,
      Key: key,
      ContentType: 'image/jpeg'
    }).promise();

    const object_url = `https://${bucket_name}.s3.amazonaws.com/${key}`;
    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: { success: true, objectUrl: object_url }
    };

    AWS.config.update({
      credentials,
      region: 'us-east-1', // Replace with your AWS_REGION
    });

    const lambda = new AWS.Lambda();
    const aggregatedData = [];

    for (const functionName of lambdaFunctions) {
      const payload = {
        body: JSON.stringify(response.body),
      };

      const lambdaParams = {
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(payload),
      };

      try {
        const lambdaResponse = await lambda.invoke(lambdaParams).promise();
        let valuedata = JSON.parse(lambdaResponse.Payload).body;
        aggregatedData.push(JSON.parse(valuedata).processed_images_urls);
      } catch (error) {
        console.error('Error invoking Lambda function:', error);
      }
    }

    res.json(aggregatedData);
  } catch (error) {
    console.error(`Error uploading image: ${error}`);
    res.status(500).json({ success: false, error: 'Internal Lambda Error' });
  }
});

app.get('/api',  (req, res) => {
res.json({'api': 'hello'})
})

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
