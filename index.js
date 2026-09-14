const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const dotenv = require('dotenv')
dotenv.config()

const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");


const app = express();
app.use(cors());
app.use(express.json());
const port = 5000



const uri = process.env.MONGODB_URI;

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {

    // Connect the client
    await client.connect();
    const db = client.db("monohor")



   
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app monohor client server running on port ${port}`)
})