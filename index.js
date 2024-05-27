const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;

////////  MIDDLEWARES  ////////////
app.use(cors());
app.use(express.json());

//////////////////////////////////
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e9we0w0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    ///////////////////////////////////
    ///////////   DATABASE   //////////
    ///////////////////////////////////
    const userCollection = client.db("KitchenTalesDB").collection("users");
    const recipeCollection = client.db("KitchenTalesDB").collection("recipes");
    ///////////////////////////////////
    ///////////     API     //////////
    ///////////////////////////////////

    ///////////     JWT     //////////

    // create jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token });
    });

    ///////////   MY  MIDDLEWARE     //////////

    // token verify middleware
    const verifyToken = (req, res, next) => {
      const tokenWithBearer = req?.headers?.authorization;
      console.log("inside verifyToken middleware //////=>", tokenWithBearer);
      if (!tokenWithBearer) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = tokenWithBearer.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decodedToken = decoded;
        console.log("decoded email:", decoded.email);
        next();
      });
    };

    ///////////     USERS     //////////

    // create user
    app.post("/users", async (req, res) => {
      // get user email form client side
      const user = req.body;
      // create user email query
      const query = { email: user.email };
      // get user from DB
      const isUserExist = await userCollection.findOne(query);
      // if user already exist in DB, then return with insertedId: null
      if (isUserExist) {
        return res.send({
          message: "user already exists in KitchenTales",
          insertedId: null,
        });
      }
      // if user don't exist in DB, then insert user in DB
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // get all users
    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    app.patch("/update-user/coins/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const amount = parseInt(req.query.amount);
      console.log(amount);

      const user = await userCollection.findOne({ email: email });

      if (!user) {
        return res.status(403).send({ message: "User not found" });
      }

      // Check if the user has enough coins
      if (user.coin < 10 && amount < 0) {
        return res.status(400).send({ message: "Not enough coins" });
      }
      // Update the user's coins based on the provided amount
      const updatedUser = await userCollection.updateOne(
        { email: email },
        { $inc: { coin: amount } }
      );

      const result = {
        message: `Coins increased by ${amount} successfully`,
        updatedUser,
      };
      res.send(result);
    });

    ///////////     RECIPE     //////////

    app.post("/add-recipe", verifyToken, async (req, res) => {
      const recipe = req.body;
      const creatorEmail = recipe.creatorEmail;
      const result = await recipeCollection.insertOne(recipe);
      const userUpdateResult = await userCollection.updateOne(
        { email: creatorEmail },
        { $inc: { coin: 1 } }
      );
      res.send({ recipeResult: result, userUpdateResult });
    });

    app.get("/all-recipe", async (req, res) => {
      const limit = parseInt(req.query.limit) || 10;
      const category = req.query.category;
      const country = req.query.country;
      const search = req.query.search;

      const filter = {};
      if (category) filter.category = category;
      if (country) filter.country = country;
      if (search) filter.recipe_name = { $regex: search, $options: "i" };

      console.log(filter);

      const recipes = await recipeCollection
        .find(filter)
        .limit(limit)
        .toArray();

      const totalRecipes = await recipeCollection.countDocuments(filter);

      const totalPages = Math.ceil(totalRecipes / limit);

      const pagination = {
        totalItems: totalRecipes,
        totalPages: totalPages,
        itemsPerPage: limit,
      };

      res.send({ recipes: recipes, pagination: pagination });
    });

    app.patch("/update-recipe/:id", async (req, res) => {
      const id = req.params.id;
      const { creatorEmail, userEmail } = req.body;
      console.log(id, creatorEmail, userEmail);

      const creatorUpdateResult = await userCollection.updateOne(
        { email: creatorEmail },
        { $inc: { coin: 1 } }
      );
      const filter = { _id: new ObjectId(id) };

      const recipe = await recipeCollection.findOne(filter);
      console.log(recipe.purchased_by);

      const updatedRecipe = {
        $set: {
          purchased_by: [...recipe.purchased_by, userEmail],
        },
        $inc: {
          watchCount: 1,
        },
      };
      console.log(updatedRecipe);

      const recipeUpdateResult = await recipeCollection.updateOne(
        filter,
        updatedRecipe
      );

      res.send({ recipeUpdateResult, creatorUpdateResult });
    });

    /*     app.get("/all-recipe", async (req, res) => {
      const result = await recipeCollection.find().toArray();
      res.send(result);
    }); */

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//////////////////////////////////
app.get("/", (req, res) => {
  res.send("KITCHEN TALES is Running");
});

app.listen(port, () => {
  console.log(`KITCHEN TALES IS RUNNING ON PORT ${port}`);
});
